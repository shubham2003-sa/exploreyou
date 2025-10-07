-- Creates the video_progress table if it does not exist
create table if not exists public.video_progress (
  id uuid primary key default gen_random_uuid(),
  user_id text,
  user_email text,
  video_id text not null,
  video_url text,
  progress double precision not null default 0,
  position_seconds double precision not null default 0,
  duration_seconds double precision,
  stream_selected text,
  task_status text,
  event_name text,
  last_event_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Upsert key across user and video identity; allow either user_id or user_email as composite
create unique index if not exists uq_video_progress_user_video on public.video_progress
  (coalesce(user_id, ''), coalesce(user_email, ''), video_id);

-- RLS policies (optional, adjust as needed)
alter table public.video_progress enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='video_progress' and policyname='Allow read to all'
  ) then
    create policy "Allow read to all" on public.video_progress for select using (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='video_progress' and policyname='Allow upsert for authenticated'
  ) then
    create policy "Allow upsert for authenticated" on public.video_progress for insert with check (true);
  end if;
end $$;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='video_progress' and policyname='Allow update for authenticated'
  ) then
    create policy "Allow update for authenticated" on public.video_progress for update using (true) with check (true);
  end if;
end $$;





