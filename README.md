# IIMF — Schedule & Student Management (MVP)

A single-user web app for one English teacher at the **Instituto de Inglês Margarida Freitas (IIMF)**. It manages students and their weekly availability, generates and approves a fixed weekly class schedule, takes attendance, tracks monthly payments and prepares WhatsApp messages.

[`SPEC.md`](SPEC.md) is the source of truth for scope, business rules, data model and acceptance criteria.

**Stack:** Next.js (App Router) · React · Tailwind CSS · Supabase (PostgreSQL + Auth) · Vercel · Vitest · Playwright

---

## Features

| Section | What it does |
|---|---|
| **Dashboard** | Today's classes, the next 7 days, Unpaid/Overdue counters and alerts (pending notifications, unallocated students, missing availability). |
| **Students** | Create, edit, view and deactivate students, with a 7 × 24 half-hour availability grid (click, drag or keyboard). Read-only after approval. |
| **Schedule** | Validates availability, generates a draft (deterministic greedy engine), lets you edit it by hand with hard errors and soft warnings, then approves it. Approval is irreversible and generates every session from 1 Sep to 31 Jul. |
| **Attendance** | Week view (desktop) and day view (mobile) calendar. Everyone is Present by default; Late/Absent take one click, and remarks are optional. Covers blocked periods, single-session cancellation and In-Person ↔ Online changes. |
| **Payments** | Post-paid monthly charges from attended hours (10 €/h group, 25 €/h individual), created automatically when a page loads (no cron). Unpaid charges become overdue on the 22nd of the next month. Supports Mark as paid / unpaid. |
| **Notifications** | Editable WhatsApp messages for absences, overdue payments, cancellations and modality changes. Each has **Copy message** and **Open WhatsApp** (`wa.me`) buttons and a filterable log. |

All dates and times use **Europe/Lisbon**, whatever time zone the server runs in.

---

## Local setup

### 1. Prerequisites
- **Node.js 20.9+** (22 LTS recommended) and npm
- A free **Supabase** project ([supabase.com](https://supabase.com))

### 2. Install
```bash
npm install
```

### 3. Environment variables
Copy the template and fill it in with your project's values (Supabase → **Project Settings → API**):

```bash
cp .env.example .env.local
```

| Variable | Needed for | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | app | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | app | Anon / publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | seed script, E2E tests | **Server-only.** It bypasses RLS. Never prefix it with `NEXT_PUBLIC_` and never add it to Vercel. |
| `E2E_TEACHER_EMAIL` / `E2E_TEACHER_PASSWORD` | E2E tests | The teacher account from step 5 |

`.env.local` is git-ignored. Never commit real credentials.

### 4. Database schema
In the Supabase **SQL Editor**, run every file in [`supabase/migrations/`](supabase/migrations/) **in order**, one at a time:

```
0001_init.sql             tables, enums, constraints, RLS policies
0002_student_rpc.sql      student save / deactivate
0003_schedule_rpc.sql     draft save / approval + session generation
0004_session_rpc.sql      blocked periods, cancel, modality
0005_attendance_rpc.sql   attendance
0006_payment_rpc.sql      lazy payment sync, overdue, paid/unpaid
0007_notification_rpc.sql notification edit / sent / dismiss
```

Row Level Security is enabled on every table: only the `authenticated` role can read or write.

### 5. Teacher account
There is no sign-up page. In Supabase go to **Authentication → Users → Add user**, enter an email and password, and tick **Auto Confirm User**. Use these credentials to log in.

### 6. Demo data
```bash
npm run seed            # ~40 fake students (all goals, levels and years; guardians for minors)
npm run seed -- --reset # delete existing students + any draft schedule, then seed again
```
The seed script refuses to run once a schedule has been approved. To start over, see [Resetting for another demo run](#resetting-for-another-demo-run).

### 7. Run
```bash
npm run dev
```
Open <http://localhost:3000> and log in.

---

## Demo walkthrough

1. **Students:** browse the seeded students; create one to show the conditional fields and the availability grid.
2. **Schedule:** generate a draft, review the groups and the *Unallocated students* panel, try a manual edit, then **Approve**.
3. **Attendance:** open a past session, mark someone Absent, add a remark, switch a session to Online, cancel one, and block a holiday period.
4. **Payments:** pick the last completed month and mark a payment as paid.
5. **Notifications:** edit a message, then use **Copy message** or **Open WhatsApp**.
6. **Dashboard:** today's and upcoming classes, counters and alerts.

> ⚠️ **Approval is irreversible in the app** (SPEC §3.4). After you approve, Students and Schedule are read-only for the whole term. To run the demo again, reset the database as shown below.

---

## Resetting for another demo run

Run this in the Supabase **SQL Editor**. It deletes **all app data** (students, schedule, sessions, attendance, payments, notifications and blocked periods) but keeps the schema and the teacher's login:

```sql
-- ⚠️ Deletes ALL app data. The schema and auth users are kept.
truncate table
  public.notifications,
  public.payments,
  public.attendance,
  public.sessions,
  public.blocked_periods,
  public.group_members,
  public.class_groups,
  public.schedules,
  public.availability_slots,
  public.students
restart identity cascade;
```

Then seed again:

```bash
npm run seed
```

---

## Testing

```bash
npm test          # Vitest unit/integration tests (no database needed; SQL runs in PGlite)
npm run lint      # ESLint
npm run build     # production build
npm run test:e2e  # Playwright end-to-end tests
```

Each acceptance criterion in `SPEC.md` (AC-x.y) is referenced in the name or comment of at least one test.

**About the E2E suite:**
- It needs `E2E_TEACHER_EMAIL`, `E2E_TEACHER_PASSWORD` and `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`. It starts `npm run dev` itself, or reuses one already running on port 3000.
- It runs against the Supabase project in `.env.local`. The schedule, calendar, attendance, payments, notifications and dashboard specs **approve a schedule**. They create their own `E2E …` students and clean up afterwards: they delete every schedule, session and payment and restore your previous draft.
- These specs **skip themselves when an approved schedule already exists**, so they never touch real term data. Run the E2E suite *before* approving the demo schedule, or use a separate Supabase project for testing.
- Projects: `desktop` and `mobile` (375 px) run in parallel; the stateful specs then run one after another.

---

## Deploying to Vercel

1. Push the repository to GitHub and **Import** it in Vercel (framework preset: Next.js).
2. Under **Settings → Environment Variables**, add only:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Don't add `SUPABASE_SERVICE_ROLE_KEY`: the deployed app never uses it.
3. Deploy. Login uses email + password, so no Supabase redirect URLs are needed.
4. Run the migrations and create the teacher account first (setup steps 4–5). Seed from your machine (`npm run seed`) if you want demo data.

---

## Project structure

```
src/app/            pages, layouts and API route handlers
  (app)/            authenticated area (sidebar layout): dashboard, students, schedule, attendance, payments, notifications
  api/              JSON endpoints (all return 401 when not logged in)
  login/            login page + server action
src/components/     UI components, grouped by section
src/lib/            business logic, validation, Supabase repositories
  scheduling/       pure scheduling engine (cohorts, slots, allocation, constraints)
src/proxy.ts        auth gate: redirects to /login, returns 401 for APIs
supabase/migrations SQL schema, RLS and database functions
scripts/seed.ts     fake-data seed script
tests/unit/         Vitest
tests/e2e/          Playwright
```
