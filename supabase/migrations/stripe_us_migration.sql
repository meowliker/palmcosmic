-- Stripe + USD migration for PalmCosmic
-- Run this in Supabase SQL editor (safe to run multiple times).

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.users
  DROP COLUMN IF EXISTS payu_payment_id,
  DROP COLUMN IF EXISTS payu_txn_id;

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS payu_txn_id,
  DROP COLUMN IF EXISTS payu_payment_id;

ALTER TABLE public.payments
  ALTER COLUMN currency SET DEFAULT 'USD';

CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON public.payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);
