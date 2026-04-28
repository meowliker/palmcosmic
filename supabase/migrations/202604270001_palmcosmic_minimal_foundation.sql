-- PalmCosmic minimal foundation schema for onboarding recovery and payment fulfillment.
-- This intentionally creates only the tables the current app needs first.

create table if not exists public.users (
  id text primary key,
  email text,
  name text,
  first_name text,
  password_hash text,
  gender text,
  age integer,
  relationship_status text,
  goals jsonb not null default '[]'::jsonb,
  birth_month text,
  birth_day text,
  birth_year text,
  birth_hour text,
  birth_minute text,
  birth_period text,
  birth_place text,
  knows_birth_time boolean default true,
  sun_sign jsonb,
  moon_sign jsonb,
  ascendant_sign jsonb,
  zodiac_sign text,
  modality text,
  polarity text,
  onboarding_flow text,
  subscription_status text default 'no',
  is_subscribed boolean default false,
  payment_status text,
  purchase_type text,
  bundle_purchased text,
  unlocked_features jsonb not null default '{"palmReading": false, "prediction2026": false, "birthChart": false, "compatibilityTest": false, "soulmateSketch": false, "futurePartnerReport": false}'::jsonb,
  coins integer not null default 0,
  scans_used integer not null default 0,
  scans_allowed integer not null default 3,
  stripe_customer_id text,
  payu_payment_id text,
  payu_txn_id text,
  timezone text,
  birth_chart_timer_active boolean not null default false,
  birth_chart_timer_started_at timestamptz,
  is_dev_tester boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_profiles (
  id text primary key,
  email text,
  gender text,
  birth_month text,
  birth_day text,
  birth_year text,
  birth_hour text,
  birth_minute text,
  birth_period text,
  birth_place text,
  knows_birth_time boolean default true,
  relationship_status text,
  goals jsonb not null default '[]'::jsonb,
  color_preference text,
  element_preference text,
  zodiac_sign text,
  sun_sign jsonb,
  moon_sign jsonb,
  ascendant_sign jsonb,
  modality text,
  polarity text,
  palm_image text,
  palm_image_url text,
  palm_reading_result jsonb,
  palm_reading_date timestamptz,
  palm_reading_report_id text,
  birth_chart_report_id text,
  soulmate_sketch_report_id text,
  future_partner_report_id text,
  prediction_2026_report_id text,
  compatibility_report_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.leads (
  id text primary key,
  email text,
  user_id text,
  gender text,
  age integer,
  relationship_status text,
  goals jsonb not null default '[]'::jsonb,
  subscription_status text default 'no',
  source text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.onboarding_sessions (
  id text primary key,
  user_id text not null,
  email text,
  current_route text,
  current_step text,
  priority_area text,
  answers jsonb not null default '{}'::jsonb,
  onboarding_data jsonb not null default '{}'::jsonb,
  source text,
  status text not null default 'in_progress',
  last_saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payments (
  id text primary key,
  user_id text,
  type text,
  bundle_id text,
  feature text,
  coins integer,
  customer_email text,
  amount integer,
  currency text default 'USD',
  payment_status text not null default 'created',
  status text,
  fulfilled_at timestamptz,
  stripe_session_id text,
  stripe_payment_intent_id text,
  stripe_customer_id text,
  payu_txn_id text,
  payu_payment_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists users_email_idx on public.users (email);
create index if not exists user_profiles_email_idx on public.user_profiles (email);
create index if not exists leads_email_idx on public.leads (email);
create index if not exists leads_user_id_idx on public.leads (user_id);
create unique index if not exists onboarding_sessions_user_id_idx on public.onboarding_sessions (user_id);
create index if not exists onboarding_sessions_email_idx on public.onboarding_sessions (email);
create index if not exists payments_user_id_idx on public.payments (user_id);
create index if not exists payments_customer_email_idx on public.payments (customer_email);
create unique index if not exists payments_stripe_session_id_idx on public.payments (stripe_session_id) where stripe_session_id is not null;
create unique index if not exists payments_stripe_payment_intent_id_idx on public.payments (stripe_payment_intent_id) where stripe_payment_intent_id is not null;
create unique index if not exists payments_payu_txn_id_idx on public.payments (payu_txn_id) where payu_txn_id is not null;
create index if not exists payments_payment_status_idx on public.payments (payment_status);
