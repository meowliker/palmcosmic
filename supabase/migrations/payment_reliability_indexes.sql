-- Payment reliability indexes for Stripe reconciliation and lookup
-- Safe to run multiple times.

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS customer_email TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'created',
  ADD COLUMN IF NOT EXISTS fulfilled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS stripe_session_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_stripe_session ON public.payments(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON public.payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status_created_at ON public.payments(payment_status, created_at);
