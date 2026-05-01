create table if not exists public.vercel_analytics_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  event_name text,
  event_timestamp timestamptz not null,
  project_id text,
  owner_id text,
  deployment text,
  session_id text,
  device_id text,
  origin text,
  path text,
  route text,
  referrer text,
  query_params text,
  country text,
  region text,
  city text,
  os_name text,
  client_name text,
  device_type text,
  vercel_environment text,
  vercel_url text,
  event_data jsonb not null default '{}'::jsonb,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create unique index if not exists vercel_analytics_events_unique_idx
  on public.vercel_analytics_events (
    event_type,
    event_timestamp,
    session_id,
    device_id,
    path,
    event_name
  )
  nulls not distinct;

create index if not exists vercel_analytics_events_timestamp_idx on public.vercel_analytics_events (event_timestamp);
create index if not exists vercel_analytics_events_type_idx on public.vercel_analytics_events (event_type);
create index if not exists vercel_analytics_events_path_idx on public.vercel_analytics_events (path);
create index if not exists vercel_analytics_events_session_idx on public.vercel_analytics_events (session_id);

alter table public.vercel_analytics_events enable row level security;
