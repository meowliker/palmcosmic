-- Direct user-to-report pointers.
-- Report content stays in its own table, but each user/profile row now stores
-- the latest report id for quick restore and dashboard access.

alter table public.users
  add column if not exists palm_reading_report_id text,
  add column if not exists birth_chart_report_id text,
  add column if not exists soulmate_sketch_report_id text,
  add column if not exists future_partner_report_id text,
  add column if not exists prediction_2026_report_id text,
  add column if not exists compatibility_report_id text;

alter table public.user_profiles
  add column if not exists palm_reading_report_id text,
  add column if not exists birth_chart_report_id text,
  add column if not exists soulmate_sketch_report_id text,
  add column if not exists future_partner_report_id text,
  add column if not exists prediction_2026_report_id text,
  add column if not exists compatibility_report_id text;

create index if not exists users_palm_reading_report_id_idx
  on public.users (palm_reading_report_id)
  where palm_reading_report_id is not null;

create index if not exists users_birth_chart_report_id_idx
  on public.users (birth_chart_report_id)
  where birth_chart_report_id is not null;

create index if not exists users_soulmate_sketch_report_id_idx
  on public.users (soulmate_sketch_report_id)
  where soulmate_sketch_report_id is not null;

create index if not exists users_future_partner_report_id_idx
  on public.users (future_partner_report_id)
  where future_partner_report_id is not null;

create index if not exists users_prediction_2026_report_id_idx
  on public.users (prediction_2026_report_id)
  where prediction_2026_report_id is not null;

create index if not exists users_compatibility_report_id_idx
  on public.users (compatibility_report_id)
  where compatibility_report_id is not null;
