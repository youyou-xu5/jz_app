-- Migration: 00002_accounts
-- Description: Create accounts table

-- =============================================================
-- ACCOUNTS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.accounts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name           text NOT NULL,
  currency       varchar(3) NOT NULL,
  account_type   text,
  initial_balance numeric(18,4) NOT NULL DEFAULT 0,
  is_archived    boolean NOT NULL DEFAULT false,
  sort_order     integer NOT NULL DEFAULT 0,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.accounts IS 'User accounts (cash, bank, ewallet, etc.)';
COMMENT ON COLUMN public.accounts.initial_balance IS 'Starting balance. Current balance = initial_balance + SUM(transactions.amount)';
COMMENT ON COLUMN public.accounts.is_archived IS 'Archived accounts cannot be deleted if they have transactions';

-- Updated_at trigger
CREATE TRIGGER accounts_set_updated_at
  BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
