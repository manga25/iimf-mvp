-- =====================================================================
-- IIMF MVP — attendance write function (SPEC.md §3.6, AC-5.3, AC-5.4)
-- Paste into the Supabase SQL editor and run once, after 0004_session_rpc.sql.
--
-- One function sets a student's attendance for one session, so the attendance
-- row and its `absence` notifications always change in ONE transaction.
-- Notification messages are rendered by the app (src/lib/notifications/);
-- this function only stores them.
--
-- Rules:
--   * No row = Present. Present with no remarks deletes the row (only
--     non-default rows are stored).
--   * Attendance can be set only for non-cancelled sessions dated today or
--     earlier (Lisbon calendar date; a session later today already counts).
--   * Becoming Absent stores the given absence notifications (student, and
--     guardian if any). Leaving Absent deletes this student's still-pending
--     absence notifications for the session; sent/dismissed ones are kept.
--     Staying Absent (e.g. editing remarks) creates no duplicates.
--
-- Error codes: IM404 unknown session · IM409 session cancelled ·
-- IM411 session in the future · 22023 invalid input.
--
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

-- Returns {"status": "...", "remarks": "..."|null, "created": <n>, "removed": <n>}.
create or replace function public.set_attendance(
  p_session_id    uuid,
  p_student_id    uuid,
  p_status        public.attendance_status,
  p_remarks       text,
  p_notifications jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_session  public.sessions;
  v_previous public.attendance_status;
  v_remarks  text := nullif(btrim(coalesce(p_remarks, '')), '');
  v_created  int := 0;
  v_removed  int := 0;
begin
  -- Locking the session serialises concurrent changes to the same register.
  select * into v_session from public.sessions where id = p_session_id for update;
  if not found then
    raise exception 'Session not found.' using errcode = 'IM404';
  end if;
  if v_session.status = 'cancelled' then
    raise exception 'Attendance cannot be set on a cancelled session.' using errcode = 'IM409';
  end if;
  if v_session.date > (now() at time zone 'Europe/Lisbon')::date then
    raise exception 'Attendance cannot be set on a future session.' using errcode = 'IM411';
  end if;

  if p_status is null then
    raise exception 'The status is required.' using errcode = '22023';
  end if;
  if char_length(v_remarks) > 500 then
    raise exception 'Remarks must have at most 500 characters.' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.group_members gm
    where gm.group_id = v_session.group_id and gm.student_id = p_student_id
  ) then
    raise exception 'This student is not in this class.' using errcode = '22023';
  end if;

  select a.status into v_previous from public.attendance a
  where a.session_id = p_session_id and a.student_id = p_student_id
  for update;
  v_previous := coalesce(v_previous, 'present');

  -- Store only non-default rows.
  if p_status = 'present' and v_remarks is null then
    delete from public.attendance where session_id = p_session_id and student_id = p_student_id;
  else
    insert into public.attendance (session_id, student_id, status, remarks)
    values (p_session_id, p_student_id, p_status, v_remarks)
    on conflict (session_id, student_id)
    do update set status = excluded.status, remarks = excluded.remarks;
  end if;

  if p_status = 'absent' and v_previous <> 'absent' then
    if p_notifications is null or jsonb_typeof(p_notifications) <> 'array'
       or jsonb_array_length(p_notifications) = 0 then
      raise exception 'Absence notifications are required.' using errcode = '22023';
    end if;
    if exists (
      select 1 from jsonb_to_recordset(p_notifications) as n(student_id uuid)
      where n.student_id is distinct from p_student_id
    ) then
      raise exception 'Every notification must belong to this student.' using errcode = '22023';
    end if;
    insert into public.notifications (student_id, type, recipient, phone, message, session_id)
    select p_student_id, 'absence', n.recipient, n.phone, n.message, p_session_id
    from jsonb_to_recordset(p_notifications)
      as n(recipient public.notification_recipient, phone text, message text);
    get diagnostics v_created = row_count;
  elsif p_status <> 'absent' and v_previous = 'absent' then
    delete from public.notifications
    where session_id = p_session_id and student_id = p_student_id
      and type = 'absence' and status = 'pending';
    get diagnostics v_removed = row_count;
  end if;

  return jsonb_build_object('status', p_status, 'remarks', v_remarks, 'created', v_created, 'removed', v_removed);
end;
$$;

-- ---------------------------------------------------------------------
-- Privileges: only the authenticated teacher (RLS still applies: security invoker).
-- ---------------------------------------------------------------------
revoke all on function public.set_attendance(uuid, uuid, public.attendance_status, text, jsonb) from public, anon;
grant execute on function public.set_attendance(uuid, uuid, public.attendance_status, text, jsonb) to authenticated;

commit;
