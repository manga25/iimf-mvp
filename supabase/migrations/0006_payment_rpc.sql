-- =====================================================================
-- IIMF MVP — payment functions (SPEC.md §3.7, AC-6.1 – AC-6.7)
-- Paste into the Supabase SQL editor and run once, after 0005_attendance_rpc.sql.
--
-- Billing is post-paid and generated lazily (no cron): every authenticated
-- page load calls sync_payments(), which creates/recalculates the rows of
-- every completed term month, and then create_overdue_notifications() with
-- the messages rendered by the app (src/lib/notifications/).
--
-- Rules:
--   * Billable session = non-cancelled session of the student's class dated
--     in month M, where the student was Present or Late (no row = Present).
--     Online costs the same as In-Person.
--   * hours = Σ durations; amount = hours × 10 € (group) or 25 € (individual).
--   * Only allocated students (members of the approved schedule) are billed,
--     and only for completed months of the term (1 Sep → 31 Jul).
--   * Months with 0 billable hours get no row. An unpaid row that drops to
--     0 hours is deleted, unless a sent/dismissed notification refers to it.
--   * Unpaid rows are recalculated; paid rows are frozen.
--   * Overdue (derived): unpaid and today ≥ the 22nd of M+1. Each overdue
--     payment gets exactly one `overdue` notification, ever.
--   * Marking Paid freezes the values, stores paid_at (not in the future)
--     and dismisses the pending overdue notification.
--
-- `p_today` defaults to today's Lisbon date; tests pass a fixed date.
--
-- Error codes: IM404 unknown payment · IM409 payment already has that status ·
-- 22023 invalid input.
--
-- Safe to run more than once (create or replace / grant are idempotent).
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- What every allocated student owes for every completed term month.
-- ---------------------------------------------------------------------
create or replace function public.payment_charges(p_today date)
returns table (student_id uuid, month date, hours numeric, amount numeric)
language sql
stable
security invoker
set search_path = ''
as $$
  with sch as (
    select s.id, s.term_start, s.term_end from public.schedules s where s.status = 'approved'
  ),
  months as (
    select gs::date as month
    from sch,
      generate_series(
        date_trunc('month', sch.term_start::timestamp),
        least(date_trunc('month', p_today::timestamp) - interval '1 month', date_trunc('month', sch.term_end::timestamp)),
        interval '1 month'
      ) as gs
  ),
  members as (
    select gm.student_id, g.id as group_id, case when g.goal = 'individual' then 25 else 10 end as rate
    from sch
    join public.class_groups g on g.schedule_id = sch.id
    join public.group_members gm on gm.group_id = g.id
  ),
  billable as (
    select mb.student_id, mo.month, mb.rate,
      coalesce(sum(extract(epoch from (s.end_time - s.start_time)) / 3600)
        filter (where s.id is not null and a.status is distinct from 'absent'), 0) as hours
    from members mb
    cross join months mo
    left join public.sessions s
      on s.group_id = mb.group_id and s.status = 'scheduled'
     and s.date >= mo.month and s.date < (mo.month + interval '1 month')
    left join public.attendance a on a.session_id = s.id and a.student_id = mb.student_id
    group by mb.student_id, mo.month, mb.rate
  )
  select b.student_id, b.month, round(b.hours, 1), round(b.hours * b.rate, 2) from billable b;
$$;

-- ---------------------------------------------------------------------
-- Lazy generation. Returns {"upserted": n, "deleted": n, "overdue": [...]},
-- where "overdue" lists the overdue payments that still need their
-- notification, with the contact data the app needs to render it.
-- ---------------------------------------------------------------------
create or replace function public.sync_payments(p_today date default null)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today    date := coalesce(p_today, (now() at time zone 'Europe/Lisbon')::date);
  v_upserted int := 0;
  v_deleted  int := 0;
  v_zero     uuid[];
  v_overdue  jsonb;
begin
  -- Locking the approved schedule serialises concurrent page loads.
  perform 1 from public.schedules where status = 'approved' for update;
  if not found then
    return jsonb_build_object('upserted', 0, 'deleted', 0, 'overdue', '[]'::jsonb);
  end if;

  insert into public.payments (student_id, month, hours, amount)
  select c.student_id, c.month, c.hours, c.amount
  from public.payment_charges(v_today) c
  where c.hours > 0
  on conflict (student_id, month) do update
    set hours = excluded.hours, amount = excluded.amount
    where public.payments.status = 'unpaid'
      and (public.payments.hours, public.payments.amount) is distinct from (excluded.hours, excluded.amount);
  get diagnostics v_upserted = row_count;

  -- Unpaid rows whose billable hours dropped to 0 (e.g. marked Absent later).
  select array_agg(p.id) into v_zero
  from public.payments p
  join public.payment_charges(v_today) c on c.student_id = p.student_id and c.month = p.month
  where p.status = 'unpaid' and c.hours = 0
    and not exists (select 1 from public.notifications n where n.payment_id = p.id and n.status <> 'pending');
  if v_zero is not null then
    delete from public.notifications where payment_id = any (v_zero);
    delete from public.payments where id = any (v_zero);
    get diagnostics v_deleted = row_count;
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'payment_id', p.id, 'student_id', p.student_id, 'month', p.month, 'amount', p.amount,
           'full_name', st.full_name, 'phone', st.phone,
           'guardian_name', st.guardian_name, 'guardian_phone', st.guardian_phone
         ) order by p.month, st.full_name), '[]'::jsonb)
    into v_overdue
  from public.payments p
  join public.students st on st.id = p.student_id
  where p.status = 'unpaid'
    and v_today >= (p.month + interval '1 month' + interval '21 days')::date
    and not exists (select 1 from public.notifications n where n.payment_id = p.id and n.type = 'overdue');

  return jsonb_build_object('upserted', v_upserted, 'deleted', v_deleted, 'overdue', v_overdue);
end;
$$;

-- ---------------------------------------------------------------------
-- Stores rendered overdue notifications: [{payment_id, recipient, phone, message}].
-- Payments that are not (or no longer) overdue are skipped; a payment that
-- already has its overdue notification is skipped too. Returns the count created.
-- ---------------------------------------------------------------------
create or replace function public.create_overdue_notifications(p_notifications jsonb, p_today date default null)
returns int
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today   date := coalesce(p_today, (now() at time zone 'Europe/Lisbon')::date);
  v_created int := 0;
begin
  if p_notifications is null or jsonb_typeof(p_notifications) <> 'array' then
    raise exception 'Notifications must be a list.' using errcode = '22023';
  end if;

  insert into public.notifications (student_id, type, recipient, phone, message, payment_id)
  select p.student_id, 'overdue', n.recipient, n.phone, n.message, p.id
  from jsonb_to_recordset(p_notifications)
    as n(payment_id uuid, recipient public.notification_recipient, phone text, message text)
  join public.payments p on p.id = n.payment_id
  where p.status = 'unpaid'
    and v_today >= (p.month + interval '1 month' + interval '21 days')::date
  on conflict (payment_id) where type = 'overdue' do nothing;
  get diagnostics v_created = row_count;

  return v_created;
end;
$$;

-- ---------------------------------------------------------------------
-- Mark a payment Paid (with paid_at) or back to Unpaid.
-- Returns {"payment": {...}, "dismissed": n}.
-- ---------------------------------------------------------------------
create or replace function public.set_payment_status(
  p_payment_id uuid,
  p_status     public.payment_status,
  p_paid_at    date
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_today     date := (now() at time zone 'Europe/Lisbon')::date;
  v_payment   public.payments;
  v_hours     numeric;
  v_amount    numeric;
  v_dismissed int := 0;
begin
  select * into v_payment from public.payments where id = p_payment_id for update;
  if not found then
    raise exception 'Payment not found.' using errcode = 'IM404';
  end if;
  if p_status is null then
    raise exception 'The status is required.' using errcode = '22023';
  end if;
  if v_payment.status = p_status then
    raise exception 'The payment already has this status.' using errcode = 'IM409';
  end if;

  -- Latest values from attendance (frozen from now on when Paid).
  select c.hours, c.amount into v_hours, v_amount
  from public.payment_charges(v_today) c
  where c.student_id = v_payment.student_id and c.month = v_payment.month;
  if v_hours is null or v_hours = 0 then
    v_hours := v_payment.hours;
    v_amount := v_payment.amount;
  end if;

  if p_status = 'paid' then
    if p_paid_at is null or p_paid_at > v_today then
      raise exception 'The payment date cannot be in the future.' using errcode = '22023';
    end if;
    update public.payments
      set status = 'paid', paid_at = p_paid_at, hours = v_hours, amount = v_amount
      where id = p_payment_id
      returning * into v_payment;
    update public.notifications
      set status = 'dismissed'
      where payment_id = p_payment_id and type = 'overdue' and status = 'pending';
    get diagnostics v_dismissed = row_count;
  else
    update public.payments
      set status = 'unpaid', paid_at = null, hours = v_hours, amount = v_amount
      where id = p_payment_id
      returning * into v_payment;
  end if;

  return jsonb_build_object(
    'payment', jsonb_build_object(
      'id', v_payment.id, 'student_id', v_payment.student_id, 'month', v_payment.month,
      'hours', v_payment.hours, 'amount', v_payment.amount,
      'status', v_payment.status, 'paid_at', v_payment.paid_at
    ),
    'dismissed', v_dismissed
  );
end;
$$;

-- ---------------------------------------------------------------------
-- Privileges: only the authenticated teacher (RLS still applies: security invoker).
-- ---------------------------------------------------------------------
revoke all on function public.payment_charges(date) from public, anon;
revoke all on function public.sync_payments(date) from public, anon;
revoke all on function public.create_overdue_notifications(jsonb, date) from public, anon;
revoke all on function public.set_payment_status(uuid, public.payment_status, date) from public, anon;
grant execute on function public.payment_charges(date) to authenticated;
grant execute on function public.sync_payments(date) to authenticated;
grant execute on function public.create_overdue_notifications(jsonb, date) to authenticated;
grant execute on function public.set_payment_status(uuid, public.payment_status, date) to authenticated;

commit;
