# SPEC — IIMF Schedule & Student Management System (MVP)

> **Instituto de Inglês Margarida Freitas (IIMF)** — single-user web app for one English teacher to manage students, generate and run a fixed weekly class schedule, take attendance, track monthly payments and prepare WhatsApp notifications.
>
> This document is the **source of truth** for scope, data model, business rules and acceptance criteria. Anything not described here is out of scope for the MVP.

---

## 1. Context & Assumptions

| # | Assumption |
|---|---|
| A1 | One user only: the teacher. No student/parent accounts. |
| A2 | All UI text and all message templates are in **English**. |
| A3 | Time zone for every date/time rule is **Europe/Lisbon**. |
| A4 | The school year (term) always runs **1 September → 31 July**. There is no `school_terms` table. |
| A5 | The teacher creates all students and approves the schedule **once**, before the term starts. After approval, the schedule and student data are frozen for the whole term. |
| A6 | No mid-year enrolments, no mid-year deactivations, no student data edits after approval. |
| A7 | Holidays (Christmas, Easter, Carnival, public holidays) are entered manually as **blocked periods**. |
| A8 | The MVP will be demonstrated with **fake data** (seed script). |
| A9 | Phone numbers default to Portugal (**+351**). |

### Term derivation
The term is derived from the approval date: if approval happens in **August–December** of year *Y*, the term is `Y-09-01 → (Y+1)-07-31`; if in **January–July** of year *Y*, the term is `(Y-1)-09-01 → Y-07-31`. Sessions are always generated for the whole term (1 Sep → 31 Jul), so the A5 assumption holds for demos run during the year.

---

## 2. Scope

### In scope
1. Authentication (single teacher account).
2. Sidebar layout with 6 sections: **Dashboard, Students, Schedule, Attendance, Payments, Notifications**.
3. Student management (create, edit, view, deactivate — only before approval) with weekly availability grid.
4. Smart scheduling engine: validate → generate draft → manual edit → approve.
5. Calendar: weekly agenda (desktop) / daily view (mobile), blocked periods, per-session cancellation and modality change.
6. Attendance: everyone Present by default, 1-click Late/Absent, optional remarks.
7. Payments: monthly charges based on hours attended in the previous month, manual "Paid" confirmation, overdue flag from the 22nd.
8. Notifications: auto-generated editable WhatsApp templates, "Copy message" + `wa.me` button, notification log.

### Out of scope (MVP)
- Student/parent logins; email sending; paid WhatsApp API; automatic message sending.
- Dedicated per-student attendance/payment history views.
- `school_terms` table, multiple terms, schedule re-generation after approval.
- Mid-year enrolment, deactivation, or edits to student data after approval.
- Specific unavailable dates per student.
- Justified vs. unjustified absences.
- Rescheduling/moving a session to another date/time; undoing a cancellation.
- Partial payments, payment methods, receipts, invoices.
- Discounts or per-student custom prices.
- "Minimum contiguous availability" validation (only "no availability at all" is checked).
- Cron jobs / background workers.
- Multiple rooms or multiple teachers.

---

## 3. Business Rules

### 3.1 Student goals

| Goal | Grouping key | Group size | Duration | Rate |
|---|---|---|---|---|
| `cambridge` | exact CEFR level (A1, A2, B1, B2, C1, C2) | 3–7 | 90 min / week | **10 €/hour** → 15 € per class |
| `school_support` | exact school year (1–12); schools may differ | 3–7 | 90 min / week | **10 €/hour** → 15 € per class |
| `individual` | — (one student per class) | 1 | 60 min / week | **25 €/hour** → 25 € per class |

Each allocated student has **exactly one class per week**.

### 3.2 Teacher working hours
- Monday–Sunday, **08:00–20:00**, on a 30-minute grid.
- One class at a time (single teacher, single room). Back-to-back classes are allowed; no buffers, no daily hour cap besides the 12 h window.
- Weekdays (Mon–Fri) are strongly preferred; weekends only when needed.

### 3.3 Availability
- Each student has a weekly availability made of 30-minute blocks between 08:00 and 20:00, Monday–Sunday.
- Stored as merged, non-overlapping intervals aligned to :00/:30.

### 3.4 Scheduling engine

**Pre-validation (blocking):** generation is **blocked** while any active student has zero availability blocks. The Schedule page lists those students with links to fix them.

**Hard constraints (never violated by the engine; manual edits that violate them are blocked):**
- H1. Classes start and end within 08:00–20:00, aligned to the 30-min grid.
- H2. No two classes overlap in time.
- H3. Group size ≤ 7 (individual class = exactly 1 student).
- H4. A group contains only students with the same goal and the same CEFR level (cambridge) or school year (school_support).
- H5. Duration is 90 min for groups and 60 min for individual classes.
- H6. A student belongs to at most one class.

**Soft constraints (engine respects them; manual edits that violate them show a warning but are allowed):**
- S1. Group size ≥ 3.
- S2. Every student in a class is available for the whole class interval.
- S3. Class is on a weekday (Mon–Fri).

**Optimisation priorities (in order):**
1. Respect all hard constraints.
2. Maximise the number of allocated students.
3. Prefer weekdays over weekends.
4. Prefer fewer groups per cohort: `k = ceil(n / 7)`.
5. Prefer **balanced** group sizes within a cohort (e.g. 9 → 5 + 4, 10 → 5 + 5, 14 → 7 + 7, 15 → 5 + 5 + 5). Never 7 + 2.
6. Prefer a compact teacher day (classes adjacent to already-placed classes; fewer gaps).

**Algorithm (deterministic greedy heuristic):**
1. Build **cohorts**: one per `(cambridge, level)`, one per `(school_support, year)`, and one per individual student.
2. A group cohort with fewer than 3 students → all its students are **unallocated** (reason: "Not enough students at this level/year").
3. For each cohort compute candidate slots: every start time on the 30-min grid where the class fits in 08:00–20:00, Mon–Sun, and for each slot the set of cohort students available for the whole interval.
4. Process cohorts **most-constrained first** (fewest feasible slots).
5. For a group cohort, compute target group count `k = ceil(n/7)` and balanced target sizes. Repeatedly pick the free slot that (a) fits the most still-unassigned students, (b) is a weekday, (c) is adjacent to an already-placed class, (d) is earliest in the week/day; fill it with up to the target size, choosing students with the fewest alternative slots first. Stop when no free slot fits ≥ 3 unassigned students.
6. For an individual cohort, pick the best free slot using the same tie-breakers (b)–(d).
7. Remaining students are **unallocated** with a reason: "Not enough students at this level/year", "No common availability with ≥ 2 peers", or "All matching slots are taken".
8. Balance is a preference: when availability forces it, unbalanced valid sizes (e.g. 6 + 3) are acceptable.

**Draft & approval:**
- Generating creates a **draft** schedule. Generating again replaces the draft (confirmation dialog: manual edits will be lost).
- Manual edits on the draft: move a student between compatible groups, assign an unallocated student to a group, remove a student from a group (→ unallocated), change a class's weekday/start time.
- **Approve** requires zero hard-constraint violations. It shows a summary (classes, allocated/unallocated students, soft warnings) and asks for confirmation.
- Approval is **irreversible** in the MVP: it generates all sessions for the term, applying existing blocked periods, and makes Students and Schedule read-only.
- Only one schedule can be approved.

### 3.5 Sessions, blocked periods & modality
- A **session** is one dated occurrence of a class. Sessions are created for every week of the term at approval.
- Default modality is **In-Person**.
- **Blocked period** (date/time range + reason): every session overlapping it becomes `cancelled`. It can be created before or after approval. **No notifications** are generated for block-based cancellations. Deleting a blocked period restores the sessions it cancelled to `scheduled`.
- **Cancel single session**: sets it to `cancelled` and generates a `cancellation` notification per student. Cannot be undone in the MVP.
- **Change modality** of a single (non-cancelled) session: In-Person ↔ Online. Each change generates a `modality_change` notification per student.

### 3.6 Attendance
- Every student of a non-cancelled session is **Present by default**. No "open/close register" step.
- The teacher can mark **Late** or **Absent** in one click; clicking the active state again returns to Present.
- Optional free-text **remarks** per student per session (≤ 500 chars).
- Attendance can be marked only for sessions whose date is today or in the past.
- Only non-default rows are stored (status ≠ present, or remarks not empty).
- Marking **Absent** generates an `absence` notification for the student **and** one for the guardian (if one exists). Reverting Absent → Present/Late deletes those notifications if they are still `pending`.

### 3.7 Payments
- Billing is **post-paid**: the charge for month *M* covers the classes attended in *M* and is created on or after the **1st of M+1**.
- **Billable session** = non-cancelled session, date within *M*, student status Present or Late (Absent is not billed). Online = same price as In-Person.
- `hours = Σ billable session durations`, `amount = hours × rate` (10 €/h group, 25 €/h individual). A 5-week month gives more classes and a higher amount; there is no cap.
- **Lazy generation (no cron):** when any authenticated page loads, the server creates the missing payment rows for every allocated student for every completed term month (unique per student+month, idempotent). Months with 0 billable hours get no payment row.
- While **unpaid**, `hours`/`amount` are recalculated from attendance. When marked **Paid**, the values are frozen and `paid_at` is stored (defaults to today, editable, not in the future).
- **Overdue** (derived, not stored): status `unpaid` and today ≥ the **22nd of M+1**.
- When a payment becomes overdue, the same lazy process creates one `overdue` notification for it, once.
- Marking a payment Paid sets its pending `overdue` notification to `dismissed`. A payment can be set back to Unpaid (confirmation) in case of a mistake.

### 3.8 Notifications
- Types: `absence`, `overdue`, `cancellation`, `modality_change`.
- **Recipient rule:** `absence` → student and guardian (separate notifications); all other types → guardian if one exists, otherwise the student.
- Every notification is created as `pending` with a pre-filled **editable** message.
- **Copy message** copies the text to the clipboard; **Open WhatsApp** opens `https://wa.me/<E.164 digits>?text=<url-encoded message>`. Either action marks it `sent` with `sent_at`.
- `sent` notifications are never changed. `dismissed` is only set automatically (paid overdue) or manually by the teacher.
- Log: list newest first, filter by type and status.

**Templates** (placeholders in `{}`):
- *absence*: "Hello {recipient_name}, this is Margarida Freitas from IIMF. {student_name} was absent from today's {class_name} class ({date}, {start_time}). Please let me know if you need anything. Thank you!"
- *overdue*: "Hello {recipient_name}, this is Margarida Freitas from IIMF. This is a friendly reminder that the {month} payment for {student_name} ({amount} €) is still pending. Thank you!"
- *cancellation*: "Hello {recipient_name}, this is Margarida Freitas from IIMF. The {class_name} class on {date} at {start_time} has been cancelled. Sorry for the inconvenience."
- *modality_change*: "Hello {recipient_name}, this is Margarida Freitas from IIMF. The {class_name} class on {date} at {start_time} will be {modality}. Thank you!"

### 3.9 Validation (server side, before any write)
- `full_name`: required, 2–100 chars, trimmed.
- `phone` / `guardian_phone`: Portuguese 9-digit number (normalised to `+351XXXXXXXXX`) or an international number with an explicit `+` prefix (E.164, 8–15 digits).
- `goal`: required. `cefr_level` required **iff** goal = cambridge. `school_year` (1–12) required **iff** goal = school_support. Otherwise both null.
- Guardian: `guardian_name` and `guardian_phone` are both filled or both empty.
- Availability: weekday 1–7, times within 08:00–20:00, multiples of 30 min, `start < end`, merged and non-overlapping.
- Blocked period: `start_at < end_at`, reason ≤ 200 chars.
- Writes to students/availability/schedule are rejected after approval (HTTP 409 with a clear message).

---

## 4. Data Model (Supabase / PostgreSQL)

All PKs are `uuid` (default `gen_random_uuid()`) unless composite. All tables have `created_at timestamptz default now()`.

### `students`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| full_name | text NOT NULL | |
| phone | text NOT NULL | E.164 |
| goal | enum `goal` (`cambridge`, `school_support`, `individual`) NOT NULL | |
| cefr_level | enum `cefr_level` (A1–C2) NULL | CHECK with goal |
| school_year | smallint NULL | CHECK 1–12, with goal |
| guardian_name | text NULL | |
| guardian_phone | text NULL | CHECK both-or-none |
| is_active | boolean NOT NULL default true | soft delete |
| updated_at | timestamptz | |

### `availability_slots`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| student_id | uuid FK → students.id ON DELETE CASCADE | |
| weekday | smallint NOT NULL | 1 = Mon … 7 = Sun |
| start_time | time NOT NULL | |
| end_time | time NOT NULL | CHECK start < end, 08:00–20:00, 30-min aligned |

### `schedules`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| status | enum (`draft`, `approved`) NOT NULL | unique partial index: at most one `approved` and one `draft` |
| term_start | date NULL | set at approval (1 Sep) |
| term_end | date NULL | set at approval (31 Jul) |
| generated_at | timestamptz NOT NULL | |
| approved_at | timestamptz NULL | |

### `class_groups`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| schedule_id | uuid FK → schedules.id ON DELETE CASCADE | |
| name | text NOT NULL | e.g. "Cambridge B2 · A", "Year 7 · A", "Individual · Ana Silva" |
| goal | enum `goal` NOT NULL | |
| cefr_level | enum NULL | |
| school_year | smallint NULL | |
| weekday | smallint NOT NULL | 1–7 |
| start_time | time NOT NULL | |
| duration_min | smallint NOT NULL | 90 or 60 |

### `group_members`
| Column | Type | Notes |
|---|---|---|
| group_id | uuid FK → class_groups.id ON DELETE CASCADE | PK (group_id, student_id) |
| student_id | uuid FK → students.id | |

Unallocated students are **derived**: active students not in any `group_members` row of the relevant schedule. The unallocation reason is computed by the engine and returned with the draft.

### `blocked_periods`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| start_at | timestamptz NOT NULL | |
| end_at | timestamptz NOT NULL | CHECK start_at < end_at |
| reason | text NOT NULL | |

### `sessions`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| group_id | uuid FK → class_groups.id | |
| date | date NOT NULL | UNIQUE (group_id, date) |
| start_time | time NOT NULL | |
| end_time | time NOT NULL | |
| status | enum (`scheduled`, `cancelled`) NOT NULL default `scheduled` | |
| modality | enum (`in_person`, `online`) NOT NULL default `in_person` | |
| blocked_period_id | uuid FK → blocked_periods.id NULL ON DELETE SET NULL | set when cancelled by a block |

### `attendance`
| Column | Type | Notes |
|---|---|---|
| session_id | uuid FK → sessions.id ON DELETE CASCADE | PK (session_id, student_id) |
| student_id | uuid FK → students.id | |
| status | enum (`present`, `late`, `absent`) NOT NULL | absence of row = present |
| remarks | text NULL | ≤ 500 chars |
| updated_at | timestamptz | |

### `payments`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| student_id | uuid FK → students.id | UNIQUE (student_id, month) |
| month | date NOT NULL | first day of the billed month |
| hours | numeric(5,1) NOT NULL | recalculated while unpaid |
| amount | numeric(7,2) NOT NULL | recalculated while unpaid |
| status | enum (`unpaid`, `paid`) NOT NULL default `unpaid` | overdue is derived |
| paid_at | date NULL | |

### `notifications`
| Column | Type | Notes |
|---|---|---|
| id | uuid PK | |
| student_id | uuid FK → students.id | |
| type | enum (`absence`, `overdue`, `cancellation`, `modality_change`) NOT NULL | |
| recipient | enum (`student`, `guardian`) NOT NULL | |
| phone | text NOT NULL | snapshot at creation |
| message | text NOT NULL | editable while pending |
| status | enum (`pending`, `sent`, `dismissed`) NOT NULL default `pending` | |
| session_id | uuid FK → sessions.id NULL | absence / cancellation / modality_change |
| payment_id | uuid FK → payments.id NULL | overdue; UNIQUE (payment_id) where type = overdue |
| sent_at | timestamptz NULL | |

**Security:** Row Level Security is enabled on every table; only the `authenticated` role may read or write. The service-role key is never exposed to the browser. Credentials live only in `.env.local`.

---

## 5. Screens & UX

**Global layout:** a fixed left sidebar on desktop and a collapsible drawer on mobile, with the 6 sections and the active state highlighted. The design is mobile-first and minimalist, with WCAG AA contrast, visible focus states and full keyboard navigation. Empty states and error messages explain what to do next. Destructive or irreversible actions (Approve, Cancel session, Regenerate draft) always ask for confirmation.

| Screen | Content |
|---|---|
| **Login** | Email + password, error message on failure. No sign-up link (the account is created in the Supabase dashboard). |
| **Dashboard** | (1) Today's classes: time, group, modality, quick link to attendance; (2) next 7 days of upcoming classes; (3) payment counters: Unpaid / Overdue, linking to Payments; (4) alerts: pending notifications count, unallocated students, students missing availability (before approval). |
| **Students** | Table/card list with search by name and filter by goal/active. Create/Edit form with conditional fields (CEFR level vs. school year), optional guardian section and a **availability grid** (7 days × 24 half-hour cells, click or drag to toggle, keyboard-operable). Student detail page. Deactivate button. After approval everything is read-only and a banner explains why. |
| **Schedule** | Before generation: validation panel (students without availability). Draft view: weekly grid of proposed classes, list of groups with members, **Unallocated students** panel with reasons, inline warnings (soft) and errors (hard), edit actions, "Regenerate" and "Approve" buttons. After approval: read-only weekly template. |
| **Attendance** (calendar) | Week view (desktop) / day view (mobile) with previous/next/today navigation. Session cards are colour-coded by goal, show an "Online" badge, and appear struck through when cancelled. Blocked periods are shaded. Clicking a session opens a panel listing its students, each with **Late** and **Absent** toggle buttons, a remarks field, and the session actions **Change modality** and **Cancel session**. A "Block period" button opens the blocked-period form; the list of blocked periods allows deletion. |
| **Payments** | Month selector (defaults to the last completed month). Table: student, hours, amount, status badge (Paid / Unpaid / **Overdue**), paid date, "Mark as paid" / "Mark as unpaid". Filter by status. Month totals: expected / received. |
| **Notifications** | Log, newest first, with filters by type/status. Each item shows recipient, phone and an editable message, plus the **Copy message** and **Open WhatsApp** buttons, a "Dismiss" button and the status badge. |

---

## 6. Acceptance Criteria

Format: **Given / When / Then**. Each item maps to at least one automated test (U = Vitest unit/integration, E = Playwright end-to-end).

### AC-1 Authentication
- AC-1.1 (E) Given I am not logged in, when I open any app route, then I am redirected to `/login`.
- AC-1.2 (E) Given valid credentials, when I log in, then I land on the Dashboard; with invalid ones, an error message is shown and I stay on `/login`.
- AC-1.3 (U) API routes return 401 for unauthenticated requests.

### AC-2 Students
- AC-2.1 (E) Given the Students page, when I create a Cambridge student with level B2, a valid phone and availability, then they appear in the list.
- AC-2.2 (U) A Cambridge student without a CEFR level, a School Support student without a year (or with year 13), or an Individual student with a level is rejected with a field-specific error.
- AC-2.3 (U) Guardian name without phone (or vice-versa) is rejected.
- AC-2.4 (U) Phone `912345678` is stored as `+351912345678`; `12345` is rejected; `+447911123456` is accepted.
- AC-2.5 (U) Availability blocks outside 08:00–20:00 or not aligned to 30 min are rejected; adjacent blocks are merged.
- AC-2.6 (E) Deactivating a student removes them from the default (active) list and from schedule generation.
- AC-2.7 (U) After approval, create/edit/deactivate requests return 409 and the UI is read-only.

### AC-3 Scheduling engine
- AC-3.1 (U/E) Given an active student with no availability, when I try to generate, then generation is blocked and the student is listed.
- AC-3.2 (U) 9 compatible B1 students → 2 groups of sizes {5, 4}. 14 → {7, 7}. 15 → {5, 5, 5}. 8 → {4, 4}.
- AC-3.3 (U) 2 compatible C2 students → both unallocated with reason "Not enough students at this level/year".
- AC-3.4 (U) The generated draft never violates H1–H6 (property test over random fixtures).
- AC-3.5 (U) Given a cohort available both Tuesday 18:00 and Saturday 10:00, the class is placed on Tuesday.
- AC-3.6 (U) Students with different levels/years are never placed in the same group.
- AC-3.7 (U) Individual students get 60-min classes; groups get 90-min classes.
- AC-3.8 (U) Same input → same output (determinism).
- AC-3.9 (E) Manual edit that creates an overlap or an 8th member is blocked with an error; one that leaves a group with 2 members or places a student outside availability shows a warning but is saved.
- AC-3.10 (E) Regenerate asks for confirmation and replaces the draft.
- AC-3.11 (U/E) Approve with hard violations is impossible; approve with none creates sessions for every week from 1 Sep to 31 Jul, and the Schedule and Students pages become read-only.

### AC-4 Calendar, exceptions & modality
- AC-4.1 (E) The week view shows all sessions of the week; on a 375 px viewport the day view is shown.
- AC-4.2 (U) Creating a blocked period 23 Dec–2 Jan cancels all overlapping sessions and creates **no** notifications; deleting it restores them to scheduled.
- AC-4.3 (U/E) Cancelling a single session sets it to cancelled and creates one `cancellation` notification per student (guardian if present, else student).
- AC-4.4 (U/E) Changing a session to Online shows the badge and creates one `modality_change` notification per student.

### AC-5 Attendance
- AC-5.1 (E) Opening a past session shows all students as Present with no action needed.
- AC-5.2 (E) One click on "Absent" marks the student absent; clicking it again returns to Present.
- AC-5.3 (U) Marking Absent creates `absence` notifications for the student and the guardian (if any); reverting removes them while still pending.
- AC-5.4 (U) Attendance cannot be set on future or cancelled sessions.
- AC-5.5 (E) Remarks are saved and shown when the session is reopened.

### AC-6 Payments
- AC-6.1 (U) A group student with 4 billable sessions in October → 6.0 h, 60.00 €; with 5 → 7.5 h, 75.00 €; with 1 Absent out of 4 → 4.5 h, 45.00 €.
- AC-6.2 (U) An individual student with 4 billable sessions → 4.0 h, 100.00 €.
- AC-6.3 (U) Cancelled sessions are not billed; Late and Online sessions are billed.
- AC-6.4 (U) Running lazy generation twice on 1 Nov creates exactly one October row per student; no row for a student with 0 billable hours.
- AC-6.5 (U) An unpaid October payment is not overdue on 21 Nov and is overdue on 22 Nov.
- AC-6.6 (U) On/after 22 Nov, lazy generation creates exactly one `overdue` notification per overdue payment.
- AC-6.7 (E/U) Marking a payment Paid stores `paid_at`, freezes the amount (later attendance changes don't alter it) and dismisses its pending overdue notification.

### AC-7 Notifications
- AC-7.1 (U) Template rendering fills all placeholders; no `{…}` remains.
- AC-7.2 (U) The `wa.me` link uses digits only (`https://wa.me/351912345678?text=…`) with a URL-encoded message.
- AC-7.3 (E) Editing the message and clicking "Copy message" copies the edited text and marks the notification Sent.
- AC-7.4 (E) The log can be filtered by type and status.

### AC-8 Dashboard
- AC-8.1 (E) It shows today's sessions, the next 7 days, unpaid/overdue counts and alerts consistent with the other pages.

### AC-9 Non-functional
- AC-9.1 `npm run build`, `npm run lint` and `npm test` pass.
- AC-9.2 No secrets in the repository; `.env.local` is git-ignored; `.env.example` documents the required variables.
- AC-9.3 All pages are usable at 375 px width and fully operable by keyboard.
- AC-9.4 All server errors are shown to the user as clear, non-technical messages.

---

## 7. Implementation Order (one flow at a time)

1. Project setup, Supabase schema + RLS migrations, auth, sidebar layout.
2. Students CRUD + validation + availability grid.
3. Seed script with fake data (~40 students covering all goals/levels/years, guardians for minors).
4. Scheduling engine (pure functions in `src/lib/scheduling/`, unit-tested first).
5. Schedule page: validation, draft, manual edits, approval + session generation.
6. Calendar views, blocked periods, cancel session, modality change.
7. Attendance panel.
8. Payments (lazy generation, overdue, mark paid).
9. Notifications (templates, log, copy / wa.me).
10. Dashboard.

Each step is finished only when its acceptance criteria tests pass and the pass/fail output is shown.
