-- Migration: 00004_exchange_rates
-- Description: Create exchange_rates table (append-only, never overwrite)

-- =============================================================
-- EXCHANGE_RATES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  base_currency  varchar(3) NOT NULL,
  quote_currency varchar(3) NOT NULL,
  rate           numeric(18,8) NOT NULL,
  source         text NOT NULL DEFAULT 'manual',
  effective_at   timestamptz NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.exchange_rates IS 'Exchange rate history. Append-only: never UPDATE, always INSERT new records';
COMMENT ON COLUMN public.exchange_rates.rate IS '1 base_currency = rate × quote_currency. Example: base=CNY, quote=THB, rate=4.8 means 1 CNY = 4.8 THB';
COMMENT ON COLUMN public.exchange_rates.source IS 'manual = user-entered, api = auto-fetched (future)';

-- CHECK: rate must be > 0
ALTER TABLE public.exchange_rates
  ADD CONSTRAINT exchange_rates_rate_positive
  CHECK (rate > 0);

-- CHECK: base and quote must be different
ALTER TABLE public.exchange_rates
  ADD CONSTRAINT exchange_rates_different_currencies
  CHECK (base_currency != quote_currency);
