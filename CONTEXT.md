# ExploreYou Code Context

Reference this document before modifying the codebase so changes stay aligned with existing patterns and project-specific guidance. Update it whenever new files are added or noteworthy rules change.

## Global Guidelines
- Supabase now owns authentication, analytics, and scoring. Keep `SUPABASE_URL`, service keys, and the public anon key available through environment variables for both local development and production.
- The frontend talks exclusively to Supabase-backed Next.js API routes; do not reintroduce `localhost` fallbacks or `NEXT_PUBLIC_BACKEND_URL` dependencies in production builds.
- Middleware-driven Supabase session handling in `my-app/lib/middleware.ts` must remain unchanged to prevent logout loops; do not mutate `request.cookies` directly.
- Many client modules cache data in `localStorage` or `sessionStorage`. Preserve graceful fallbacks for SSR/non-browser contexts and respect existing TTL logic.

## Legacy Backend (`backend/`)
- FastAPI remains available for migrations, data repair, and optional tooling, but the live site no longer routes traffic to it. Leave it dormant unless you have a specific maintenance task.
- `main.py` - Historical FastAPI app that mirrors the new Next.js API surface (auth, session tracking, scores, video progress). It still expects Supabase credentials and is useful as a reference implementation.
- `supabase_client.py` - Async HTTPX wrapper centralising Supabase REST calls and credential management. Reuse these helpers when scripting against Supabase outside of Next.js.
- `supabase_repo.py` - Repository layer that marshals datetime fields and talks to Supabase tables for users, sessions, dwell metrics, video progress, and scores. Pass naive/UTC datetimes; helpers serialise/parse for you.
- `data/*.json` - Seed data for legacy experiments.
- `requirements.txt` - Minimal dependency list (`fastapi`, `uvicorn`, `supabase`, etc.).
- Utility scripts: `check_tables.py`, `migrate_users.py`, `session_test.py`, `smoke_test.py`, `tmp_connect*.py`, `tmp_print_env.py` - Troubleshooting, migration, and connectivity helpers. Keep `.env` accurate for these scripts.
- Logs (`event_error.log`, `server_err.log`) are diagnostic artefacts; only rotate when necessary.

## Frontend (`my-app/`)

### Root-Level
- `package.json` / `package-lock.json` – Next.js configuration with dependencies (`@supabase/ssr`, Tailwind 3, shadcn UI, etc.).
- `netlify.toml` – Build config for Netlify (base `my-app`, `npm run build`, Next plugin).
- `middleware.ts` – Re-exports `updateSession` from `lib/middleware`. Keep ordering untouched to mirror Supabase guidance.
- `.env.local` – Local environment overrides (not committed).
- Tooling configs: `tailwind.config.ts`, `postcss.config.mjs`, `tsconfig.json`, `components.json`.
- `.next/` – Build artifacts (ignore in source control).

### App Directory (`app/`)
- `layout.tsx` – Root layout loading Geist fonts and wrapping children in `ClientWrapper`.
- `globals.css` – Tailwind base styles, CSS variables, and keyframes. Global selectors now set `border-color`/`background` via raw CSS instead of `@apply`.
- `page.tsx` – Landing page showing hero `VideoPlayer` and CTA that reroutes to `/study-streams` or `/login`.
- `login/page.tsx` – Primary login UI that calls `/api/login` (Supabase-backed) and redirects to `/study-streams`.
- `auth/sign-up/page.tsx` – Sign-up form posting to `/api/register`; stores a minimal profile on success. Email verification is handled by Supabase auth—users appear in Supabase immediately but may be unconfirmed.
- `protected/page.tsx` – Auth-guarded dashboard using middleware redirects and local storage.
- `study-streams/page.tsx` – Core interactive stream selection experience with **Consulting** flow restored from commit `634660c`. Coordinates fullscreen overlays, records progress (`/api/video-progress`), and routes into task simulations.
  - The overlay timer is scheduled only after `handleOverlayPlaybackChange` confirms playback; keep the countdown anchored by the centered progress bar.
  - Consulting flow stores both option key and descriptive label; continue passing the label in the `label` query parameter for `/task-simulation`.
- `video-player/[subject]/page.tsx` – Subject-specific player page loading progress, writing events, and driving fullscreen controls. Flags (`video_autoplay`, `video_fullscreen`) are read from `sessionStorage`; errors are swallowed safely.
- `next-video/[subject]/page.tsx` – Follow-up video flow. Consulting segments keep interactive buttons; non-interactive subjects auto-advance to `/task-simulation/{subject}` after `video_completed` fires. Non-interactive videos start muted to comply with autoplay policies.
- API routes:
  - `/api/login`, `/api/logout`, `/api/register`, `/api/me`, `/api/video-progress`, `/api/videos`, `/api/health`, `/api/auth/resend-confirmation`, `/api/generate-video`, `/api/page-sessions/*`, `/api/scores/*` - All run with `runtime = "nodejs"` to access Supabase libraries.
  - `/api/page-sessions/start`, `/api/page-sessions/[psid]/events-batch`, `/api/page-sessions/[psid]/cursor-dwell`, `/api/page-sessions/[psid]/end` persist navigation analytics directly to Supabase tables (`page_sessions`, `events`, `cursor_dwell_metrics`).
  - `/api/scores/me` and `/api/scores/events` surface Supabase `user_scores` data and aggregate new events.
  - `/api/videos` lists Supabase storage objects and returns signed URLs (TTL defaults to `NEXT_PUBLIC_SUPABASE_SIGNED_URL_TTL`). Falls back to public paths if signing fails.



### Components (`components/`)
- `client-wrapper.tsx` – Client entry that mounts `SessionTracker`, `ScoreBar`, and provides `ScoreProvider`.
- `header.tsx` – Shared header syncing with `/api/me` and updating stored profile.
- `session-tracker.tsx` - Tracks navigation/cursor events, batches them, and syncs with the Supabase-backed `/api/page-sessions` routes. Mouse-move dwell tracking remains commented out, but click logging and periodic queue flushing are re-enabled (flush every 2s via `flushTimerRef`).
- `video-player.tsx` – Full-featured video player with overlays, timers, Supabase progress tracking, and optional response buttons. Event listeners mount once and rely on refs for fresh callbacks; avoid reintroducing dependencies that would rebind listeners or pause playback on cleanup.
- `score-provider.tsx` - React context hitting `/api/scores/me` and `/api/scores/events` with local caching and `recordScoreEvent`.
- `score-bar.tsx` – Floating aggregate score display.
- `components/ui/*` – Shadcn-inspired primitives (`button`, `input`, `label`, `card`, etc.) for consistent styling.

### Config & Libs
- `config/cursor-targets.ts` – Registry for page-specific cursor dwell targets consumed by `SessionTracker`.
- `lib/auth-storage.ts` – Persists auth profile (`userEmail`, `userName`) to browser storage.
- `lib/client.ts` / `lib/server.ts` – Supabase client factories for browser/server usage.
- `lib/middleware.ts` – Core Supabase middleware logic invoked by `app/middleware.ts`. Do not insert logic between client creation and `auth.getUser()`.
- `lib/user-identity.ts` – Resolves identity from Supabase and caches in storage/session.
- `lib/user-score.ts` - Fetches and records scores through the Supabase-backed `/api/scores` routes with caching.
- `lib/video-progress.ts` – Utilities for recording and retrieving video progress through Next.js API.
- `lib/video-url.ts` – Resolves Supabase storage URLs. Generates signed URLs with caching (session storage + in-memory) and falls back to public URLs if signing fails.
- `lib/video-constants.ts` – Default fallback video URLs driven by environment or baked-in values.
- `lib/video-generator.ts` - Optional hook to call an external video generator via `NEXT_PUBLIC_BACKEND_URL`; always supply a deployed URL (never localhost) or guard the UI that depends on it.
- `lib/utils.ts` – Tailwind `cn` helper built on `clsx` and `tailwind-merge`.
- `lib/cursor-targets.ts` – Hook for broadcasting cursor target metadata with proper cleanup.

### Scripts & Database
- `scripts/001_create_users_table.sql` - Supabase SQL migration creating `profiles` table and trigger to mirror auth users.
- `scripts/002_create_video_progress_table.sql` - Defines `video_progress` table with RLS policies and unique index.
- Supabase must also provide `page_sessions`, `events`, `cursor_dwell_metrics`, and `user_scores` tables for the Next.js API layer.

### Assets & Misc
- `app/fonts/` – Local Geist font files loaded by `layout.tsx`.
- `premade videos/` (repo root) – Static video assets referenced by `VideoPlayer` fallbacks.
- `.gitignore` (root & project) – Keep build artifacts, env files, and caches untracked.

## Using This Document
- Before editing a file, skim its entry to understand dependencies and cautions.
- When new files are added or behaviors change, append concise descriptions and any new guidelines so future contributors stay aligned.
