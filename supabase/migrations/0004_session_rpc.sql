-- =====================================================================
-- IIMF MVP — blocked periods & session write functions (SPEC.md §3.5, AC-4.2–4.4)
-- Paste into the Supabase SQL editor and run once, after 0003_schedule_rpc.sql.
--
-- Every write goes through these functions so that:
--   * a blocked period and the sessions it cancels/restores change in ONE transaction;
--   * a session change and its notifications are saved in ONE transaction.
-- Notification messages are rendered by the app (src/lib/notifications/);
-- these functions only store them.
--
-- Blocked-period times are Europe/Lisbon wall-clock times (timestamp without
-- time zone) and are converted here, so the app does no time-zone maths.
--
-- Error codes: IM404 unknown row · IM409 session already cancelled ·
-- IM410 session already finished · IM412 session already has that modality ·
-- 22023 invalid input.
--
-- Block functions take the advisory lock 4210001 (shared with 0002/0003), so
-- creating/deleting a block and an approval (which generates sessions) never interleave.
--
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

-- A session's date + time (Lisbon wall-clock) as an absolute instant.
create or replace function public.lisbon_instant(p_date date, p_time time) returns timestamptz
language sql
immutable
set search_path = ''
as $$ select (p_date + p_time) at time zone 'Europe/Lisbon' $$;

-- ---------------------------------------------------------------------
-- Blocked periods
-- ---------------------------------------------------------------------

-- Creates a blocked period and cancels every overlapping *scheduled* session,
-- linking it to the block. No notifications (SPEC §3.5). Sessions that are
-- already cancelled keep their current link (decision: first block wins).
-- Returns {"id": "<uuid>", "cancelled": <n>}.
create or replace function public.create_blocked_period(
  p_start  timestamp,
  p_end    timestamp,
  p_reason text
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id    uuid;
  v_start timestamptz := p_start at time zone 'Europe/Lisbon';
  v_end   timestamptz := p_end   at time zone 'Europe/Lisbon';
  v_count int;
begin
  perform pg_advisory_xact_lock(4210001);

  if p_start is null or p_end is null or p_start >= p_end then
    raise exception 'The start must be before the end.' using errcode = '22023';
  end if;
  if p_reason is null or char_length(btrim(p_reason)) not between 1 and 200 then
    raise exception 'The reason must have 1 to 200 characters.' using errcode = '22023';
  end if;

  insert into public.blocked_periods (start_at, end_at, reason)
  values (v_start, v_end, btrim(p_reason))
  returning id into v_id;

  update public.sessions s set status = 'cancelled', blocked_period_id = v_id
  where s.status = 'scheduled'
    and public.lisbon_instant(s.date, s.start_time) < v_end
    and public.lisbon_instant(s.date, s.end_time)   > v_start;
  get diagnostics v_count = row_count;

  return jsonb_build_object('id', v_id, 'cancelled', v_count);
end;
$$;

-- Deletes a blocked period. Each session it cancelled is linked to another
-- block that still overlaps it, or restored to 'scheduled' when there is none.
-- Sessions cancelled individually (blocked_period_id null) are never touched.
-- Returns {"restored": <n>}. Raises IM404 for an unknown block.
create or replace function public.delete_blocked_period(p_id uuid) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_count int;
begin
  perform pg_advisory_xact_lock(4210001);

  if not exists (select 1 from public.blocked_periods where id = p_id) then
    raise exception 'Blocked period not found.' using errcode = 'IM404';
  end if;

  -- Must run before the delete: ON DELETE SET NULL would erase the link.
  with linked as (
    select s.id, (
      select bp.id from public.blocked_periods bp
      where bp.id <> p_id
        and public.lisbon_instant(s.date, s.start_time) < bp.end_at
        and public.lisbon_instant(s.date, s.end_time)   > bp.start_at
      order by bp.start_at, bp.id
      limit 1
    ) as next_block
    from public.sessions s
    where s.blocked_period_id = p_id
  ), changed as (
    update public.sessions s set
      blocked_period_id = l.next_block,
      status = case when l.next_block is null then 'scheduled' else 'cancelled' end::public.session_status
    from linked l
    where s.id = l.id
    returning s.status
  )
  select count(*) filter (where status = 'scheduled') into v_count from changed;

  delete from public.blocked_periods where id = p_id;

  return jsonb_build_object('restored', v_count);
end;
$$;

-- ---------------------------------------------------------------------
-- Single-session changes (each one stores its notifications)
-- ---------------------------------------------------------------------

-- Locks a session that may still be changed: exists, not cancelled, not finished.
create or replace function public.lock_changeable_session(p_id uuid) returns public.sessions
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.sessions;
begin
  select * into v from public.sessions where id = p_id for update;
  if not found then
    raise exception 'Session not found.' using errcode = 'IM404';
  end if;
  if v.status = 'cancelled' then
    raise exception 'This session is already cancelled.' using errcode = 'IM409';
  end if;
  if public.lisbon_instant(v.date, v.end_time) <= now() then
    raise exception 'This session has already finished.' using errcode = 'IM410';
  end if;
  return v;
end;
$$;

-- Inserts the app-rendered notifications of one session:
-- [{"student_id":"<uuid>","recipient":"guardian","phone":"+351…","message":"…"}, ...].
-- Every student must be a member of the session's class.
create or replace function public.insert_session_notifications(
  p_session       public.sessions,
  p_type          public.notification_type,
  p_notifications jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if p_notifications is null or jsonb_typeof(p_notifications) <> 'array' then
    raise exception 'Notifications must be a JSON array.' using errcode = '22023';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_notifications) as n(student_id uuid)
    where not exists (
      select 1 from public.group_members gm
      where gm.group_id = p_session.group_id and gm.student_id = n.student_id
    )
  ) then
    raise exception 'Every notification must belong to a student of this class.' using errcode = '22023';
  end if;

  insert into public.notifications (student_id, type, recipient, phone, message, session_id)
  select n.student_id, p_type, n.recipient, n.phone, n.message, p_session.id
  from jsonb_to_recordset(p_notifications)
    as n(student_id uuid, recipient public.notification_recipient, phone text, message text);
end;
$$;

-- Cancels one session and stores one 'cancellation' notification per student.
-- Cannot be undone (SPEC §3.5).
create or replace function public.cancel_session(p_id uuid, p_notifications jsonb) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.sessions;
begin
  v := public.lock_changeable_session(p_id);
  update public.sessions set status = 'cancelled' where id = p_id;
  perform public.insert_session_notifications(v, 'cancellation', p_notifications);
end;
$$;

-- Changes one session's modality and stores one 'modality_change' notification
-- per student. Earlier pending notifications are left alone (decision).
create or replace function public.set_session_modality(
  p_id            uuid,
  p_modality      public.modality,
  p_notifications jsonb
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v public.sessions;
begin
  v := public.lock_changeable_session(p_id);
  if p_modality is null or v.modality = p_modality then
    raise exception 'This session already has that modality.' using errcode = 'IM412';
  end if;
  update public.sessions set modality = p_modality where id = p_id;
  perform public.insert_session_notifications(v, 'modality_change', p_notifications);
end;
$$;

-- ---------------------------------------------------------------------
-- Privileges: only the authenticated teacher (RLS still applies: security invoker).
-- ---------------------------------------------------------------------
revoke all on function public.lisbon_instant(date, time) from public, anon;
revoke all on function public.create_blocked_period(timestamp, timestamp, text) from public, anon;
revoke all on function public.delete_blocked_period(uuid) from public, anon;
revoke all on function public.lock_changeable_session(uuid) from public, anon;
revoke all on function public.insert_session_notifications(public.sessions, public.notification_type, jsonb) from public, anon;
revoke all on function public.cancel_session(uuid, jsonb) from public, anon;
revoke all on function public.set_session_modality(uuid, public.modality, jsonb) from public, anon;

grant execute on function public.lisbon_instant(date, time) to authenticated;
grant execute on function public.create_blocked_period(timestamp, timestamp, text) to authenticated;
grant execute on function public.delete_blocked_period(uuid) to authenticated;
grant execute on function public.lock_changeable_session(uuid) to authenticated;
grant execute on function public.insert_session_notifications(public.sessions, public.notification_type, jsonb) to authenticated;
grant execute on function public.cancel_session(uuid, jsonb) to authenticated;
grant execute on function public.set_session_modality(uuid, public.modality, jsonb) to authenticated;

commit;
