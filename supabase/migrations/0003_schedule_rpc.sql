-- =====================================================================
-- IIMF MVP — schedule write functions (SPEC.md §3.4, §3.5, AC-3.11)
-- Paste into the Supabase SQL editor and run once, after 0002_student_rpc.sql.
--
-- Every write to the draft and the approval go through these functions so that:
--   * the draft's groups and members are replaced in ONE transaction;
--   * approval and session generation happen in ONE transaction;
--   * writes are refused once a schedule is approved (errcode IM409 → HTTP 409).
-- Hard-constraint checks (H1–H6) run in the app (src/lib/scheduling/constraints.ts);
-- the table CHECKs from 0001 are the safety net.
--
-- All functions take the advisory lock 4210001, shared with
-- public.assert_students_editable() (0002), so a student write and an approval
-- can never interleave.
--
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

-- Raises IM409 when an approved schedule exists (and holds the shared lock).
create or replace function public.assert_schedule_editable() returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(4210001);
  if exists (select 1 from public.schedules where status = 'approved') then
    raise exception 'The schedule has been approved and can no longer be changed.'
      using errcode = 'IM409';
  end if;
end;
$$;

-- Replaces the draft's classes with p_groups (creating the draft if none exists):
-- [{"name":"Cambridge B2 · A","goal":"cambridge","cefr_level":"B2","school_year":null,
--   "weekday":2,"start_time":"18:00","duration_min":90,"member_ids":["<uuid>", ...]}, ...]
-- p_regenerate = true marks a fresh engine run (updates generated_at);
-- false is a manual edit. Returns the draft schedule id.
create or replace function public.save_draft(
  p_groups     jsonb,
  p_regenerate boolean default false
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_schedule uuid;
  v_group    uuid;
  g          jsonb;
begin
  perform public.assert_schedule_editable();

  if p_groups is null or jsonb_typeof(p_groups) <> 'array' then
    raise exception 'Groups must be a JSON array.' using errcode = '22023';
  end if;

  select id into v_schedule from public.schedules where status = 'draft';

  if v_schedule is null then
    insert into public.schedules (status, generated_at)
    values ('draft', now())
    returning id into v_schedule;
  else
    if p_regenerate then
      update public.schedules set generated_at = now() where id = v_schedule;
    end if;
    -- group_members cascade.
    delete from public.class_groups where schedule_id = v_schedule;
  end if;

  for g in select value from jsonb_array_elements(p_groups) loop
    if jsonb_typeof(g->'member_ids') is distinct from 'array' then
      raise exception 'Each group needs a member_ids array.' using errcode = '22023';
    end if;

    insert into public.class_groups
      (schedule_id, name, goal, cefr_level, school_year, weekday, start_time, duration_min)
    values (
      v_schedule,
      g->>'name',
      (g->>'goal')::public.goal,
      (g->>'cefr_level')::public.cefr_level,
      (g->>'school_year')::smallint,
      (g->>'weekday')::smallint,
      (g->>'start_time')::time,
      (g->>'duration_min')::smallint
    )
    returning id into v_group;

    insert into public.group_members (group_id, student_id)
    select v_group, m::uuid
    from jsonb_array_elements_text(g->'member_ids') as m;
  end loop;

  return v_schedule;
end;
$$;

-- Approves the draft for the term p_term_start (1 Sep) → p_term_end (31 Jul)
-- and creates one session per class per week of the term. Sessions that
-- overlap an existing blocked period (Europe/Lisbon wall-clock time) are
-- created cancelled with blocked_period_id set — no notifications (SPEC §3.5).
-- Raises IM409 if already approved, IM404 if there is no draft,
-- 22023 for an invalid term or an empty draft. Returns the schedule id.
create or replace function public.approve_schedule(
  p_term_start date,
  p_term_end   date
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_schedule uuid;
begin
  perform public.assert_schedule_editable();

  if p_term_start is null or p_term_end is null
     or extract(month from p_term_start) <> 9 or extract(day from p_term_start) <> 1
     or p_term_end <> make_date(extract(year from p_term_start)::int + 1, 7, 31) then
    raise exception 'The term must run from 1 September to 31 July.' using errcode = '22023';
  end if;

  select id into v_schedule from public.schedules where status = 'draft';
  if v_schedule is null then
    raise exception 'There is no draft schedule to approve.' using errcode = 'IM404';
  end if;

  if not exists (select 1 from public.class_groups where schedule_id = v_schedule) then
    raise exception 'The draft has no classes to approve.' using errcode = '22023';
  end if;

  update public.schedules set
    status      = 'approved',
    term_start  = p_term_start,
    term_end    = p_term_end,
    approved_at = now()
  where id = v_schedule;

  insert into public.sessions (group_id, date, start_time, end_time, status, blocked_period_id)
  select
    s.group_id, s.date, s.start_time, s.end_time,
    case when b.id is null then 'scheduled' else 'cancelled' end::public.session_status,
    b.id
  from (
    select
      cg.id                                              as group_id,
      d::date                                            as date,
      cg.start_time                                      as start_time,
      cg.start_time + make_interval(mins => cg.duration_min) as end_time,
      (d::date + cg.start_time) at time zone 'Europe/Lisbon' as starts_at,
      (d::date + cg.start_time + make_interval(mins => cg.duration_min)) at time zone 'Europe/Lisbon' as ends_at
    from public.class_groups cg
    -- timestamp (no tz) so isodow/::date never depend on the session TimeZone.
    cross join generate_series(p_term_start::timestamp, p_term_end::timestamp, interval '1 day') as d
    where cg.schedule_id = v_schedule
      and extract(isodow from d) = cg.weekday
  ) s
  left join lateral (
    select bp.id
    from public.blocked_periods bp
    where bp.start_at < s.ends_at and bp.end_at > s.starts_at
    order by bp.start_at, bp.id
    limit 1
  ) b on true;

  return v_schedule;
end;
$$;

-- Only the authenticated teacher may call these (RLS still applies: security invoker).
revoke all on function public.assert_schedule_editable() from public, anon;
revoke all on function public.save_draft(jsonb, boolean) from public, anon;
revoke all on function public.approve_schedule(date, date) from public, anon;

grant execute on function public.assert_schedule_editable() to authenticated;
grant execute on function public.save_draft(jsonb, boolean) to authenticated;
grant execute on function public.approve_schedule(date, date) to authenticated;

commit;
