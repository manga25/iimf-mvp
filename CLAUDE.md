# Project Memory — MVP (ASI - FEUP)

## Tech Stack
- **Framework:** Next.js (App Router) with React
- **Styling:** Tailwind CSS (mobile-first, responsive design)
- **Database:** Supabase (PostgreSQL)
- **Hosting:** Vercel
- **Testing:** Vitest (unit/integration) and Playwright (critical flows)

## Architecture & Folder Structure
Use a clean, modular structure. Keep files small (under ~200 lines) with clear responsibilities:
- `src/app/` — Pages, layouts, and API routes (UI and HTTP endpoints)
- `src/components/` — Reusable UI components
- `src/lib/` — Database client (Supabase), validation helpers, and business logic
- `tests/` — Automated tests mirroring the main flows
- `SPEC.md` — Source of truth for features, data tables, and acceptance criteria

## Workflow Rules
1. Always read `SPEC.md` before planning or implementing any feature.
2. Follow **Explore → Plan → Implement → Verify**: present a short plan before writing code.
3. Build one user flow at a time. Do not add features outside `SPEC.md` scope.
4. Never consider a task done without running automated tests and showing the pass/fail output.
5. Keep git commits small and descriptive.

## Security & Code Quality
- **Never** hardcode API keys, passwords, or database credentials in code. Always use `.env.local` (and ensure `.env.local` is in `.gitignore`).
- Validate all user inputs on the server side before saving to Supabase.
- Handle errors gracefully and show clear messages to the user.
- Ensure UI follows good UX principles: visual hierarchy, color contrast, spacing, consistency, keyboard accessibility, and mobile responsiveness.

## Commands
- `npm run dev` — Start local development server
- `npm run build` — Verify production build succeeds
- `npm test` — Run automated test suite
- `npm run lint` — Check code style and errors