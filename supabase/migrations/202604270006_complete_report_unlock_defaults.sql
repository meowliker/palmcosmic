-- Keep new users aligned with the full report unlock model.
-- Existing rows are handled by application-side normalization, but this makes
-- future rows start with every report flag present and every report id column ready.

alter table public.users
  alter column unlocked_features set default
    '{"palmReading": false, "prediction2026": false, "birthChart": false, "compatibilityTest": false, "soulmateSketch": false, "futurePartnerReport": false}'::jsonb,
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
