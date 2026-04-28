-- Storage needed by the soulmate sketch funnel and generation APIs.

create extension if not exists pgcrypto;

create table if not exists public.soulmate_sketches (
  id uuid primary key default gen_random_uuid(),
  user_id text not null references public.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'generating', 'complete', 'failed')),
  question_answers jsonb not null default '{}'::jsonb,
  provider text,
  provider_job_id text,
  prompt text,
  sketch_image_url text,
  generation_count integer not null default 0
    check (generation_count >= 0 and generation_count <= 1),
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id)
);

create index if not exists soulmate_sketches_user_id_idx on public.soulmate_sketches(user_id);
create index if not exists soulmate_sketches_status_idx on public.soulmate_sketches(status);

alter table public.soulmate_sketches enable row level security;

drop policy if exists "users_own_soulmate_sketches" on public.soulmate_sketches;
create policy "users_own_soulmate_sketches" on public.soulmate_sketches
  for all using (user_id = auth.uid()::text)
  with check (user_id = auth.uid()::text);
