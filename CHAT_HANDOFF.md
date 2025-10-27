# ExploreYou Handoff Notes

Use this document whenever you need to restart the chat or bring a new collaborator onboard. It captures the current architecture, the state of Supabase, and the recent fixes we made in this session.

## Project Overview

- **Frontend:** Next.js (App Router) in `my-app/`, deployed to Netlify.
- **Styling / UI:** Tailwind + shadcn components; custom video player and overlay logic.
- **Auth:** Supabase Auth (email/password). Public routes live under `app/api/`.
- **Backend:** All runtime logic is handled by Next.js API routes; the legacy FastAPI service is no longer in the serving path.

## Key User Flows

1. **Sign Up / Login**
   - `app/auth/sign-up/page.tsx` posts to `/api/register`.
   - `app/login/page.tsx` posts to `/api/login`; when Supabase returns tokens, the route mirrors the `exploreyou_session_id` cookie back into `page_sessions`.
   - `/api/me` returns the current profile; stored in browser storage via `useScore`, `SessionTracker`, etc.

2. **Study Streams → Video Flow**
   - `/study-streams` triggers overlays, videos, and session tracking.
   - Video playback flows into `/next-video/[subject]` → `/next-tasks/[subject]/[option]` → `/task-simulation/[subject]`.
   - Score updates are handled via `/api/scores/events` and exposed with `/api/scores/me`.

3. **Session / Analytics Tracking**
   - `components/session-tracker.tsx` starts a page session on mount, batches events, cursor dwell metrics, and closes the session on unload.
   - Every API call persists directly into Supabase tables (no FastAPI).

## Supabase Schema (public schema)

These tables must exist:

| Table | Purpose | Critical Columns |
| --- | --- | --- |
| `page_sessions` | One row per visit | `id uuid`, `user_session_id uuid`, `user_id uuid`, `user_email text`, `page text`, `event_count int`, `click_count int`, `score double precision`, `duration_seconds int`, `created_at timestamptz`, `last_event_at timestamptz`, `ended_at timestamptz` |
| `events` | Raw click / overlay events | `page_session_id uuid`, `event_type text`, `event_timestamp timestamptz`, `data jsonb`, `x`, `y` |
| `cursor_dwell_metrics` | Aggregate dwell data | `page_session_id uuid`, `target_key text`, `total_duration_ms bigint`, `total_entries int`, `first_seen`, `last_updated`, `extra_metadata jsonb` |
| `video_progress` | Video/task progress | Already created via repo migration (`scripts/002_create_video_progress_table.sql`) |
| `user_scores` | Aggregate points | `user_id uuid`, `user_email text`, `total_points numeric`, `total_possible numeric`, `updated_at timestamptz` |
| `auth_login_events` *(optional but recommended)* | Login audit trail | `user_id uuid`, `user_email text`, `user_session_id uuid`, `logged_in_at timestamptz` |

### RLS Policies

For tables that receive anonymous writes before login (e.g., `page_sessions`, `events`, `cursor_dwell_metrics`, `video_progress`), enable policies:

```sql
create policy "allow insert" on public.table_name
  for insert
  with check (auth.role() = 'authenticated' or auth.role() = 'anon');

create policy "allow select" on public.table_name
  for select
  using (auth.role() = 'authenticated' or auth.role() = 'anon');
```

Adjust as needed on other tables (`user_scores` may remain authenticated-only).

## Recent Fixes

1. **Analytics insertion failures**
   - Dropped `page_sessions_user_session_id_fkey` because we now use the browser cookie `exploreyou_session_id`.
   - Recreated `user_session_id` and `user_id` columns as UUIDs.
   - Ensured `/api/page-sessions/start` returns `201` after schema fix.

2. **Anonymous sessions → authenticated user linkage**
   - `/api/login` now reads the `exploreyou_session_id` cookie and updates any matching `page_sessions` row with `user_id`/`user_email` immediately.
   - `/api/page-sessions/[psid]/events-batch`, `/cursor-dwell`, and `/end` backfill `user_id`/`user_email` whenever a user is present.

3. **Docs cleanup**
   - `CONTEXT.md` updated with Supabase cookie details and API behavior.
   - Extra tables `public.sessions`, `public.users` removed (use `auth.users` instead).

## Data Checks

- **Sign-ups:** `select email, created_at, email_confirmed_at from auth.users order by created_at desc;`
- **Login history (if using audit table):** `select * from public.auth_login_events order by logged_in_at desc;`
- **Page sessions:** `select * from public.page_sessions order by created_at desc;`

To view timestamps in IST without changing storage:

```sql
set time zone 'Asia/Kolkata';
select id, created_at, ended_at, last_event_at from public.page_sessions order by created_at desc;
```

## Outstanding Gotchas

- If you see `invalid input syntax for type integer`, the column is still typed as `integer`.
- If you see `violates row level security`, update RLS policies.
- Ensure environment variables (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) are set in Netlify.

## How to Move to a New Chat

1. Save this file (`CHAT_HANDOFF.md`) plus the up-to-date `CONTEXT.md`.
2. Start the new chat, paste a short summary, and point to both docs.
3. Mention any pending TODOs: e.g., hook up `auth_login_events` audit insert if desired, run end-to-end tests, etc.

Keeping these notes handy ensures you won’t lose context when tokens reset or collaborators rotate.
