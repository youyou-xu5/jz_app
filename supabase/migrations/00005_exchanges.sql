-- Migration: 00005_exchanges
-- Description: Create exchanges table for cross-currency exchange operations

-- =============================================================
-- EXCHANGES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.exchanges (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  to_account_id   uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  from_currency   varchar(3) NOT NULL,
  to_currency     varchar(3) NOT NULL,
  from_amount     numeric(18,4) NOT NULL,
  to_amount       numeric(18,4) NOT NULL,
  reference_rate  numeric(18,8),
  actual_rate     numeric(18,8) NOT NULL,
  fee_amount      numeric(18,4),
  fee_currency    varchar(3),
  transaction_date date NOT NULL,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exchanges IS 'Cross-currency exchange records. Each exchange generates 2 transactions linked by exchange_id';
COMMENT ON COLUMN public.exchanges.reference_rate IS 'The rate at time of exchange for reference (may differ from actual_rate due to spread/fees)';
COMMENT ON COLUMN public.exchanges.actual_rate IS 'actual_rate = to_amount / from_amount (or from / to if reversed). Always in direction: 1 base = rate × quote';

-- CHECK: from_account != to_account
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_different_accounts
  CHECK (from_account_id != to_account_id);

-- CHECK: from_currency != to_currency (if same currency, use transfer instead)
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_different_currencies
  CHECK (from_currency != to_currency);

-- CHECK: amounts must be positive
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_from_amount_positive
  CHECK (from_amount > 0);

ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_to_amount_positive
  CHECK (to_amount > 0);

-- CHECK: actual_rate must be positive
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_actual_rate_positive
  CHECK (actual_rate > 0);

-- Updated_at trigger
CREATE TRIGGER exchanges_set_updated_at
  BEFORE UPDATE ON public.exchanges
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
