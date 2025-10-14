# ExploreYou Code Context

Reference this document before modifying the codebase so changes align with existing patterns and project-specific guidance. Update it whenever new files are added or additional rules are introduced.

## Global Guidelines
- Backend and frontend both rely on Supabase credentials; flows expect `SUPABASE_URL`/keys to be available via environment.
- Many client modules cache data in `localStorage`/`sessionStorage`; preserve graceful fallbacks when running in non-browser contexts.
- Keep middleware-side Supabase session handling exactly as written (see `my-app/lib/middleware.ts`) to avoid unexpected logouts.

## Backend (`backend/`)
- `main.py` — FastAPI application exposing auth, session tracking, score, and video-progress endpoints backed by Supabase. Raises at import time if Supabase credentials are missing. Handles login/logout hashing, paged session events, cursor dwell aggregation, and score calculations.
- `supabase_client.py` — Thin async HTTPX wrapper for calling Supabase REST API; central place for credentials and request helpers.
  - *Guideline:* Throws if credentials are absent; reuse helpers instead of making direct HTTP calls.
- `supabase_repo.py` — Repository layer that marshals datetime fields and interacts with Supabase tables for users, sessions, page sessions, cursor dwell metrics, video progress, and scores.
  - *Guideline:* Always pass naive/UTC datetimes; helpers serialize/parse for you.
- `data/videos.json` — Seed data for videos served by the backend/Next.js app.
- `requirements.txt` — Minimal dependency list (`fastapi`, `uvicorn`, `supabase`, etc.) for the backend service.
- `check_tables.py` — Utility to verify database connectivity and list public tables using `psycopg2`.
- `migrate_users.py` — Async SQLAlchemy script to migrate `data/users.json` into a Postgres users table using models defined in `main.py`.
- `session_test.py` / `smoke_test.py` — Quick manual scripts hitting running backend endpoints to validate login and session APIs.
- `supabase_client.py`, `supabase_repo.py`, and `main.py` rely on environment configuration loaded via `.env`; keep `.env` up to date.
- `tmp_connect.py`, `tmp_connect_sqlalchemy.py`, `tmp_print_env.py` — Local troubleshooting helpers for environment and database connectivity.
- Logs (`event_error.log`, `server_err.log`) are diagnostic artifacts; do not overwrite without need.

## Frontend (`my-app/`)

### Root-Level
- `package.json` / `package-lock.json` — Next.js app configuration with dependencies (`@supabase/ssr`, Tailwind, shadcn UI).
- `middleware.ts` — Re-exports `updateSession` from `lib/middleware`.
  - *Guideline:* Do not modify middleware cookie handling order; it mirrors Supabase documentation to prevent session mismatch.
- `.env.local` — Local Next.js environment overrides (not committed).
- `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `components.json` — Tooling configuration.
- `.next/` — Build artifacts (ignore during development).

### App Directory (`app/`)
- `layout.tsx` — Root layout loading custom Geist fonts and wrapping children with `ClientWrapper`.
- `globals.css` — Tailwind base styles + custom keyframes and CSS variables.
- `page.tsx` — Landing page with hero `VideoPlayer`, overlays, and CTA redirecting to `/study-streams` or `/login`.
- `login/page.tsx` — Primary login UI using Supabase-auth-backed `/api/login`.
- `login.tsx` — Legacy/basic login screen; currently unused but still fetches `/api/login`.
- `auth/sign-up/page.tsx` — Sign-up form calling `/api/register`; saves minimal profile locally on success.
- `score.tsx` — Simple page consuming `/api/users/:email` to display/update score (endpoints currently only provided by backend FastAPI).
- `users.tsx` — Fetches `/api/users`; appears to target backend FastAPI route (not implemented in Next.js).
- `protected/page.tsx` — Gated dashboard reading user info from `localStorage`; relies on middleware redirect for auth.
- `study-streams/page.tsx` ??" Core interactive stream selection page: overlays videos, records progress via `video-progress` API, persists choices, coordinates fullscreen overlays, and routes into task simulations.
  - *Guideline:* The fullscreen overlay timer now starts only after the main video reports it is playing, derives the countdown from the remaining clip duration, and still waits up to ~5??_s before showing. Keep timer scheduling behind the `handleOverlayPlaybackChange` callback so intro clips (e.g., Consulting) do not trigger early auto-close. The white countdown line uses a centered bar whose width decreases over time; keep it anchored with `translateX(-50%)` so it contracts toward the middle while the outer edges fade.
  - Consulting flow keeps both the option key and a descriptive label (`selectedOptionRef` / `selectedOptionLabelRef`); continue passing the label through the `label` query parameter so `/task-simulation` renders the friendly choice text.
  - Video order (Consulting): `ExploreYou Intro.mp4` ? `in flight option for excited.mp4` ? `Monday 6:30 am.mp4` ? `Airplane Video.mp4`. Preserve these identifiers when swapping clips so resume logic stays aligned.
- `video-player/[subject]/page.tsx` — Plays primary subject video using `VideoPlayer` component, resumes from saved progress, and surfaces navigation to simulations.
- `next-video/[subject]/page.tsx` — Fullscreen follow-up video experience with option buttons leading to `/next-tasks`.
- `task-simulation/[subject]/page.tsx` ??" Simulation dashboard with timers, mock analytics, score submission (`recordScore`, backend PUT to `/users/.../stream-scores`).
  - Consulting entries expect a descriptive `label` query parameter (e.g., "Review Market Intelligence"); keep that in sync with `study-streams` when adjusting option text.
- `next-tasks/[subject]/[option]/page.tsx` — Option-specific task checklist; records completion status with video-progress API and updates overall score.
- `api/login/route.ts` — Supabase password auth; mirrors cookie updates to Next.js response. Handles “email not confirmed” errors explicitly.
- `api/logout/route.ts` — Signs out via Supabase and clears auth cookies.
- `api/register/route.ts` — Wraps Supabase sign-up, returning confirmation hints if email not verified.
- `api/me/route.ts` — Returns current Supabase user profile; treated as soft auth check.
- `api/videos/route.ts` — Lists files in Supabase storage bucket (defaults to `videos`).
- `api/video-progress/route.ts` — REST proxy for Supabase `video_progress` table with upsert-on-conflict fallback logic.
- `api/health/route.ts` — Diagnostics endpoint summarizing environment, auth, and bucket access.
- `api/generate-video/route.ts` — Calls stub `generateAIVideo` helper; currently returns placeholder URLs.
- `api/auth/resend-confirmation/route.ts` — Resends Supabase email confirmation for an address.

### Components (`components/`)
- `client-wrapper.tsx` — Client-side wrapper that mounts `SessionTracker`, `ScoreBar`, and provides `ScoreProvider`.
- `header.tsx` — Shared header with auth-aware buttons; keeps `localStorage` profile in sync with `/api/me`.
- `session-tracker.tsx` — Listens for navigation/cursor events, batches them, syncs with backend `/page-sessions` and `/cursor-dwell` endpoints.
- `video-player.tsx` — Feature-rich video player with custom overlays, Supabase progress tracking hooks, fullscreen handling, and optional response buttons.
  - *Guideline:* Event listeners now mount once and rely on refs for the latest callbacks/state. Avoid reintroducing effect dependencies that would force reattachment or call `video.pause()` during cleanup, otherwise the play button will auto-pause again.
  - `score-provider.tsx` — React context fetching `/api/scores` (backend) with caching and `recordScoreEvent` helper.
  - `score-bar.tsx` — Floating status bar showing aggregated score data.
- `components/ui/*` — Shadcn-derived primitives (`button`, `input`, `label`, `card`); use for consistent styling instead of raw elements.

### Config & Libs
- `config/cursor-targets.ts` — Registry for page-specific cursor dwell targets consumed by `SessionTracker`.
- `lib/auth-storage.ts` — Persists auth profile to browser storage; automatically stores `userEmail`/`userName`.
- `lib/client.ts` / `lib/server.ts` — Supabase client factories for browser/server contexts.
- `lib/middleware.ts` — Core Supabase middleware logic invoked by `app/middleware.ts`.
  - *Guideline:* Comments warn against adding logic between client creation and `auth.getUser()`; follow to avoid session bugs.
- `lib/user-identity.ts` — Resolves identity by querying Supabase auth or `localStorage`, with session caching.
- `lib/user-score.ts` — Fetches/records scores via `/api/scores` backend endpoints with local caching.
- `lib/video-progress.ts` — Records and retrieves video progress through Next.js API, caching per user/video.
- `lib/video-url.ts` — Resolves Supabase storage URLs with caching; falls back to default URLs if Supabase unavailable.
- `lib/video-constants.ts` — Default fallback video URLs from env or baked-in signed links.
- `lib/video-generator.ts` — Stub for AI video generation (currently returns placeholder message per comment).
- `lib/utils.ts` — Tailwind `cn` helper (clsx + twMerge).
- `lib/cursor-targets.ts` — Hook for broadcasting cursor target metadata; ensures cleanup on unmount.
- `lib/user-identity.ts`, `lib/video-progress.ts`, and `lib/user-score.ts` all rely on storage caches; respect TTL logic when extending.

### Scripts & DB
- `scripts/001_create_users_table.sql` — Supabase SQL migration creating `profiles` table & trigger to mirror auth users.
- `scripts/002_create_video_progress_table.sql` — Defines `video_progress` table plus RLS policies and unique index.

### Assets & Misc
- `app/fonts/` — Local Geist font files loaded by `layout.tsx`.
- `premade videos/` (root) — Static video assets referenced by `VideoPlayer`.
- `.gitignore` (root & project) — Ensures build artifacts, env files, and local caches stay untracked.

## How to Use This Document
- Before editing a file, skim its entry to understand dependencies and any embedded cautions.
- When adding new files or receiving new coding instructions, append concise descriptions and note the related guidance so future work stays aligned.


