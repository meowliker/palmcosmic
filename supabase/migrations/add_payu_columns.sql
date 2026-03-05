-- Add PayU columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payu_payment_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS payu_txn_id TEXT;

-- Add PayU columns to payments table
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payu_txn_id TEXT;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS payu_payment_id TEXT;

-- Also add missing profile columns to users table (for profile edit to work)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS relationship_status TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_month TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_day TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_year TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_hour TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_minute TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_period TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS birth_place TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS moon_sign TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS ascendant_sign TEXT;
