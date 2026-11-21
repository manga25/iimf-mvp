-- =====================================================================
-- IIMF MVP — initial schema (SPEC.md §4)
-- Paste into the Supabase SQL editor and run once.
-- =====================================================================
begin;

-- ---------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------
create type public.goal as enum ('cambridge', 'school_support', 'individual');
create type public.cefr_level as enum ('A1', 'A2', 'B1', 'B2', 'C1', 'C2');
create type public.schedule_status as enum ('draft', 'approved');
create type public.session_status as enum ('scheduled', 'cancelled');
create type public.modality as enum ('in_person', 'online');
create type public.attendance_status as enum ('present', 'late', 'absent');
create type public.payment_status as enum ('unpaid', 'paid');
create type public.notification_type as enum ('absence', 'overdue', 'cancellation', 'modality_change');
create type public.notification_recipient as enum ('student', 'guardian');
create type public.notification_status as enum ('pending', 'sent', 'dismissed');

-- ---------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------
create function public.set_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- students
-- ---------------------------------------------------------------------
create table public.students (
  id             uuid primary key default gen_random_uuid(),
  full_name      text not null,
  phone          text not null,
  goal           public.goal not null,
  cefr_level     public.cefr_level,
  school_year    smallint,
  guardian_name  text,
  guardian_phone text,
  is_active      boolean not null default true,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),

  constraint students_full_name_chk
    check (full_name = btrim(full_name) and char_length(full_name) between 2 and 100),
  constraint students_phone_e164_chk
    check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint students_school_year_range_chk
    check (school_year between 1 and 12),
  constraint students_goal_fields_chk check (
    (goal = 'cambridge'      and cefr_level is not null and school_year is null) or
    (goal = 'school_support' and cefr_level is null     and school_year is not null) or
    (goal = 'individual'     and cefr_level is null     and school_year is null)
  ),
  constraint students_guardian_both_or_none_chk
    check ((guardian_name is null) = (guardian_phone is null)),
  constraint students_guardian_name_chk
    check (guardian_name is null or (guardian_name = btrim(guardian_name) and char_length(guardian_name) between 2 and 100)),
  constraint students_guardian_phone_e164_chk
    check (guardian_phone is null or guardian_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- availability_slots (merging / non-overlap is enforced by the app)
-- ---------------------------------------------------------------------
create table public.availability_slots (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id) on delete cascade,
  weekday    smallint not null,
  start_time time not null,
  end_time   time not null,
  created_at timestamptz not null default now(),

  constraint availability_weekday_chk check (weekday between 1 and 7),
  constraint availability_window_chk
    check (start_time >= time '08:00' and end_time <= time '20:00' and start_time < end_time),
  constraint availability_grid_chk check (
    extract(epoch from start_time)::int % 1800 = 0 and
    extract(epoch from end_time)::int % 1800 = 0
  )
);

create index availability_slots_student_idx on public.availability_slots (student_id);

-- ---------------------------------------------------------------------
-- schedules (at most one draft and one approved)
-- ---------------------------------------------------------------------
create table public.schedules (
  id           uuid primary key default gen_random_uuid(),
  status       public.schedule_status not null,
  term_start   date,
  term_end     date,
  generated_at timestamptz not null default now(),
  approved_at  timestamptz,
  created_at   timestamptz not null default now(),

  constraint schedules_approved_fields_chk check (
    status = 'draft' or
    (term_start is not null and term_end is not null and approved_at is not null)
  ),
  constraint schedules_term_order_chk check (term_start < term_end)
);

create unique index schedules_one_approved_idx on public.schedules (status) where status = 'approved';
create unique index schedules_one_draft_idx    on public.schedules (status) where status = 'draft';

-- ---------------------------------------------------------------------
-- class_groups
-- ---------------------------------------------------------------------
create table public.class_groups (
  id           uuid primary key default gen_random_uuid(),
  schedule_id  uuid not null references public.schedules (id) on delete cascade,
  name         text not null,
  goal         public.goal not null,
  cefr_level   public.cefr_level,
  school_year  smallint,
  weekday      smallint not null,
  start_time   time not null,
  duration_min smallint not null,
  created_at   timestamptz not null default now(),

  constraint class_groups_name_chk check (char_length(btrim(name)) between 1 and 100),
  constraint class_groups_weekday_chk check (weekday between 1 and 7),
  constraint class_groups_school_year_range_chk check (school_year between 1 and 12),
  constraint class_groups_goal_fields_chk check (
    (goal = 'cambridge'      and cefr_level is not null and school_year is null) or
    (goal = 'school_support' and cefr_level is null     and school_year is not null) or
    (goal = 'individual'     and cefr_level is null     and school_year is null)
  ),
  -- H5: 60 min for individual, 90 min for groups
  constraint class_groups_duration_chk
    check ((goal = 'individual' and duration_min = 60) or (goal <> 'individual' and duration_min = 90)),
  -- H1: within 08:00–20:00 on the 30-min grid
  constraint class_groups_window_chk check (
    start_time >= time '08:00' and
    start_time + make_interval(mins => duration_min) <= time '20:00' and
    extract(epoch from start_time)::int % 1800 = 0
  )
);

create index class_groups_schedule_idx on public.class_groups (schedule_id);

-- ---------------------------------------------------------------------
-- group_members (H3/H4/H6 are enforced by the app/engine)
-- ---------------------------------------------------------------------
create table public.group_members (
  group_id   uuid not null references public.class_groups (id) on delete cascade,
  student_id uuid not null references public.students (id),
  created_at timestamptz not null default now(),
  primary key (group_id, student_id)
);

create index group_members_student_idx on public.group_members (student_id);

-- ---------------------------------------------------------------------
-- blocked_periods
-- ---------------------------------------------------------------------
create table public.blocked_periods (
  id         uuid primary key default gen_random_uuid(),
  start_at   timestamptz not null,
  end_at     timestamptz not null,
  reason     text not null,
  created_at timestamptz not null default now(),

  constraint blocked_periods_order_chk check (start_at < end_at),
  constraint blocked_periods_reason_chk check (char_length(btrim(reason)) between 1 and 200)
);

-- ---------------------------------------------------------------------
-- sessions
-- ---------------------------------------------------------------------
create table public.sessions (
  id                uuid primary key default gen_random_uuid(),
  group_id          uuid not null references public.class_groups (id),
  date              date not null,
  start_time        time not null,
  end_time          time not null,
  status            public.session_status not null default 'scheduled',
  modality          public.modality not null default 'in_person',
  blocked_period_id uuid references public.blocked_periods (id) on delete set null,
  created_at        timestamptz not null default now(),

  constraint sessions_group_date_key unique (group_id, date),
  constraint sessions_time_order_chk check (start_time < end_time),
  constraint sessions_block_implies_cancelled_chk
    check (blocked_period_id is null or status = 'cancelled')
);

create index sessions_date_idx on public.sessions (date);
create index sessions_blocked_period_idx on public.sessions (blocked_period_id);

-- ---------------------------------------------------------------------
-- attendance (only non-default rows are stored; no row = present)
-- ---------------------------------------------------------------------
create table public.attendance (
  session_id uuid not null references public.sessions (id) on delete cascade,
  student_id uuid not null references public.students (id),
  status     public.attendance_status not null,
  remarks    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (session_id, student_id),

  constraint attendance_remarks_len_chk check (char_length(remarks) <= 500),
  constraint attendance_non_default_chk
    check (status <> 'present' or coalesce(btrim(remarks), '') <> '')
);

create index attendance_student_idx on public.attendance (student_id);

create trigger attendance_set_updated_at
  before update on public.attendance
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- payments (overdue is derived, never stored)
-- ---------------------------------------------------------------------
create table public.payments (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  month      date not null,
  hours      numeric(5,1) not null,
  amount     numeric(7,2) not null,
  status     public.payment_status not null default 'unpaid',
  paid_at    date,
  created_at timestamptz not null default now(),

  constraint payments_student_month_key unique (student_id, month),
  constraint payments_month_first_day_chk check (extract(day from month) = 1),
  constraint payments_non_negative_chk check (hours >= 0 and amount >= 0),
  constraint payments_paid_at_chk check ((status = 'paid') = (paid_at is not null))
);

-- ---------------------------------------------------------------------
-- notifications
-- ---------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students (id),
  type       public.notification_type not null,
  recipient  public.notification_recipient not null,
  phone      text not null,
  message    text not null,
  status     public.notification_status not null default 'pending',
  session_id uuid references public.sessions (id),
  payment_id uuid references public.payments (id),
  sent_at    timestamptz,
  created_at timestamptz not null default now(),

  constraint notifications_phone_e164_chk check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  constraint notifications_message_chk check (char_length(btrim(message)) > 0),
  constraint notifications_sent_at_chk check ((status = 'sent') = (sent_at is not null)),
  constraint notifications_link_chk check (
    (type = 'overdue'  and payment_id is not null and session_id is null) or
    (type <> 'overdue' and session_id is not null and payment_id is null)
  )
);

create unique index notifications_one_overdue_per_payment_idx
  on public.notifications (payment_id) where type = 'overdue';
create index notifications_created_idx on public.notifications (created_at desc);
create index notifications_student_idx on public.notifications (student_id);
create index notifications_session_idx on public.notifications (session_id);

-- ---------------------------------------------------------------------
-- Row Level Security: only the authenticated role may read or write.
-- ---------------------------------------------------------------------
alter table public.students           enable row level security;
alter table public.availability_slots enable row level security;
alter table public.schedules          enable row level security;
alter table public.class_groups       enable row level security;
alter table public.group_members      enable row level security;
alter table public.blocked_periods    enable row level security;
alter table public.sessions           enable row level security;
alter table public.attendance         enable row level security;
alter table public.payments           enable row level security;
alter table public.notifications      enable row level security;

create policy students_authenticated_all           on public.students           for all to authenticated using (true) with check (true);
create policy availability_slots_authenticated_all on public.availability_slots for all to authenticated using (true) with check (true);
create policy schedules_authenticated_all          on public.schedules          for all to authenticated using (true) with check (true);
create policy class_groups_authenticated_all       on public.class_groups       for all to authenticated using (true) with check (true);
create policy group_members_authenticated_all      on public.group_members      for all to authenticated using (true) with check (true);
create policy blocked_periods_authenticated_all    on public.blocked_periods    for all to authenticated using (true) with check (true);
create policy sessions_authenticated_all           on public.sessions           for all to authenticated using (true) with check (true);
create policy attendance_authenticated_all         on public.attendance         for all to authenticated using (true) with check (true);
create policy payments_authenticated_all           on public.payments           for all to authenticated using (true) with check (true);
create policy notifications_authenticated_all      on public.notifications      for all to authenticated using (true) with check (true);

-- Defence in depth: the anonymous role gets no table privileges at all.
revoke all on all tables in schema public from anon;

commit;
