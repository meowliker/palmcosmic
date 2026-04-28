-- Subscription and report entitlement foundation.
-- This keeps report access explicit so trial, monthly subscription, and later add-on purchases can coexist safely.

alter table public.users
  add column if not exists access_status text not null default 'locked',
  add column if not exists primary_flow text,
  add column if not exists primary_report text,
  add column if not exists trial_started_at timestamptz,
  add column if not exists trial_ends_at timestamptz,
  add column if not exists subscription_current_period_end timestamptz,
  add column if not exists subscription_cancel_at_period_end boolean not null default false,
  add column if not exists subscription_locked_at timestamptz,
  add column if not exists subscription_lock_reason text,
  add column if not exists subscription_plan text,
  add column if not exists stripe_subscription_id text;

alter table public.payments
  add column if not exists flow text,
  add column if not exists report_key text,
  add column if not exists billing_kind text,
  add column if not exists stripe_subscription_id text;

create table if not exists public.user_entitlements (
  id text primary key,
  user_id text not null,
  report_key text not null,
  source text not null,
  status text not null default 'active',
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  stripe_subscription_id text,
  stripe_session_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_entitlements_user_id_idx on public.user_entitlements (user_id);
create index if not exists user_entitlements_report_key_idx on public.user_entitlements (report_key);
create index if not exists user_entitlements_status_idx on public.user_entitlements (status);
create unique index if not exists user_entitlements_unique_active_source_idx
  on public.user_entitlements (user_id, report_key, source)
  where status = 'active';

create index if not exists users_access_status_idx on public.users (access_status);
create index if not exists users_stripe_subscription_id_idx on public.users (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists payments_stripe_subscription_id_idx on public.payments (stripe_subscription_id) where stripe_subscription_id is not null;
create index if not exists payments_report_key_idx on public.payments (report_key);
