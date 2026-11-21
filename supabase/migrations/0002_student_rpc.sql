-- =====================================================================
-- IIMF MVP — student write functions (SPEC.md §3.9, AC-2.7)
-- Paste into the Supabase SQL editor and run once, after 0001_init.sql.
--
-- Every write to students/availability goes through these functions so that:
--   * the student row and its availability are saved in ONE transaction;
--   * writes are refused once a schedule is approved (errcode IM409 → HTTP 409).
-- Input validation and availability merging happen in the app
-- (src/lib/students/validation.ts); the table CHECKs from 0001 are the safety net.
--
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Table privileges. RLS policies (0001) only filter rows; the role also needs
-- GRANTs, which newer Supabase projects no longer add automatically.
-- anon keeps no privileges at all (0001).
-- ---------------------------------------------------------------------
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all on all tables in schema public to service_role; -- seed script (Flow 3); bypasses RLS, server only

-- Raises IM409 when an approved schedule exists. Takes a transaction-level
-- advisory lock so a concurrent approval (Flow 5 must take the same lock,
-- key 4210001) cannot slip in between this check and the write.
create or replace function public.assert_students_editable() returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(4210001);
  if exists (select 1 from public.schedules where status = 'approved') then
    raise exception 'Students are read-only because the schedule has been approved.'
      using errcode = 'IM409';
  end if;
end;
$$;

-- Creates (p_id null) or updates (p_id set) a student and replaces their
-- availability with p_availability: [{"weekday":1,"start_time":"09:00","end_time":"10:30"}, ...].
-- Returns the student id. Raises IM404 when updating an unknown student.
create or replace function public.save_student(
  p_id             uuid,
  p_full_name      text,
  p_phone          text,
  p_goal           public.goal,
  p_cefr_level     public.cefr_level,
  p_school_year    smallint,
  p_guardian_name  text,
  p_guardian_phone text,
  p_availability   jsonb default '[]'::jsonb
) returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_id uuid;
begin
  perform public.assert_students_editable();

  if p_availability is null or jsonb_typeof(p_availability) <> 'array' then
    raise exception 'Availability must be a JSON array.' using errcode = '22023';
  end if;

  if p_id is null then
    insert into public.students
      (full_name, phone, goal, cefr_level, school_year, guardian_name, guardian_phone)
    values
      (p_full_name, p_phone, p_goal, p_cefr_level, p_school_year, p_guardian_name, p_guardian_phone)
    returning id into v_id;
  else
    update public.students set
      full_name      = p_full_name,
      phone          = p_phone,
      goal           = p_goal,
      cefr_level     = p_cefr_level,
      school_year    = p_school_year,
      guardian_name  = p_guardian_name,
      guardian_phone = p_guardian_phone
    where id = p_id
    returning id into v_id;

    if v_id is null then
      raise exception 'Student not found.' using errcode = 'IM404';
    end if;

    delete from public.availability_slots where student_id = v_id;
  end if;

  insert into public.availability_slots (student_id, weekday, start_time, end_time)
  select v_id, a.weekday, a.start_time, a.end_time
  from jsonb_to_recordset(p_availability) as a(weekday smallint, start_time time, end_time time);

  return v_id;
end;
$$;

-- Soft delete (is_active = false). Raises IM404 for an unknown student.
create or replace function public.deactivate_student(p_id uuid) returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  perform public.assert_students_editable();

  update public.students set is_active = false where id = p_id;
  if not found then
    raise exception 'Student not found.' using errcode = 'IM404';
  end if;
end;
$$;

-- Only the authenticated teacher may call these (RLS still applies: security invoker).
revoke all on function public.assert_students_editable() from public, anon;
revoke all on function public.save_student(uuid, text, text, public.goal, public.cefr_level, smallint, text, text, jsonb) from public, anon;
revoke all on function public.deactivate_student(uuid) from public, anon;

grant execute on function public.assert_students_editable() to authenticated;
grant execute on function public.save_student(uuid, text, text, public.goal, public.cefr_level, smallint, text, text, jsonb) to authenticated;
grant execute on function public.deactivate_student(uuid) to authenticated;

commit;
