create table if not exists public.palm_readings (
  id text primary key,
  reading jsonb,
  palm_image_url text,
  birth_date text,
  zodiac_sign text,
  deleted_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.natal_charts (
  id text primary key,
  chart jsonb,
  dasha jsonb,
  signs jsonb,
  birth_data jsonb,
  created_at timestamptz default now()
);

create table if not exists public.chat_messages (
  id text primary key,
  messages jsonb default '[]'::jsonb,
  updated_at timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.daily_insights (
  id text primary key,
  date text,
  insights jsonb,
  lucky_numbers integer[],
  lucky_colors text[],
  affirmation text,
  mood text,
  energy_level integer,
  focus_area text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

create table if not exists public.astrology_signs_cache (
  id text primary key,
  data jsonb,
  cached_at timestamptz default now()
);

create table if not exists public.compatibility (
  id text primary key,
  sign1 text not null,
  sign2 text not null,
  overall_score integer,
  emotional_score integer,
  intellectual_score integer,
  physical_score integer,
  spiritual_score integer,
  summary text,
  strengths text[],
  challenges jsonb,
  toxicity_score integer,
  toxicity_description text,
  created_at timestamptz default now()
);

create table if not exists public.ab_tests (
  id text primary key,
  name text,
  status text default 'active',
  traffic_split numeric default 0.5,
  last_reset_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.ab_test_assignments (
  id text primary key,
  test_id text references public.ab_tests(id) on delete cascade,
  visitor_id text,
  variant text not null,
  created_at timestamptz default now()
);

create table if not exists public.ab_test_events (
  id serial primary key,
  test_id text references public.ab_tests(id) on delete cascade,
  variant text not null,
  event_type text not null,
  visitor_id text,
  metadata jsonb,
  created_at timestamptz default now()
);

create table if not exists public.ab_test_stats (
  id text primary key,
  test_id text references public.ab_tests(id) on delete cascade,
  variant text not null,
  impressions integer default 0,
  conversions integer default 0,
  bounces integer default 0,
  checkouts_started integer default 0,
  total_revenue numeric default 0,
  updated_at timestamptz default now()
);

create index if not exists idx_ab_assignments_test on public.ab_test_assignments(test_id);
create index if not exists idx_ab_events_test on public.ab_test_events(test_id);
create index if not exists palm_readings_deleted_at_idx on public.palm_readings(deleted_at);
create index if not exists chat_messages_updated_at_idx on public.chat_messages(updated_at);
create index if not exists daily_insights_expires_at_idx on public.daily_insights(expires_at);
