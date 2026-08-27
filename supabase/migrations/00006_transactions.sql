-- Migration: 00006_transactions
-- Description: Create transactions table (core ledger)
-- Depends on: accounts (00002), categories (00003), exchanges (00005)

-- =============================================================
-- TRANSACTIONS TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.transactions (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  account_id         uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  transaction_type   text NOT NULL,
  category_id        uuid REFERENCES public.categories(id) ON DELETE SET NULL,

  amount             numeric(18,4) NOT NULL,
  currency           varchar(3) NOT NULL,

  base_currency      varchar(3) NOT NULL,
  exchange_rate      numeric(18,8) NOT NULL,
  base_amount        numeric(18,4) NOT NULL,

  transaction_date   date NOT NULL,
  note               text,

  transfer_group_id  uuid,
  exchange_id        uuid REFERENCES public.exchanges(id) ON DELETE CASCADE,

  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.transactions IS 'Core transaction ledger. All amounts use signed convention: income=+, expense=-, transfer-in=+, transfer-out=-';
COMMENT ON COLUMN public.transactions.amount IS 'Signed amount in transaction currency. Income positive, expense negative';
COMMENT ON COLUMN public.transactions.exchange_rate IS 'Rate snapshot at time of transaction. 1 base = rate × quote. Immutable after creation';
COMMENT ON COLUMN public.transactions.base_amount IS 'amount converted to base_currency. = amount when same currency, = amount/rate when different';
COMMENT ON COLUMN public.transactions.transfer_group_id IS 'Shared UUID for transfer pairs. Two transactions with same group_id = one transfer';
COMMENT ON COLUMN public.transactions.exchange_id IS 'FK to exchanges table. Set for exchange-type transactions (2 per exchange)';

-- =============================================================
-- CHECK CONSTRAINTS
-- =============================================================

-- transaction_type must be valid
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_type_check
  CHECK (transaction_type IN ('expense', 'income', 'transfer', 'exchange'));

-- amount != 0
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_amount_not_zero
  CHECK (amount != 0);

-- exchange_rate > 0
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_rate_positive
  CHECK (exchange_rate > 0);

-- currency must be 3 chars
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_currency_length
  CHECK (char_length(currency) = 3);

-- base_currency must be 3 chars
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_base_currency_length
  CHECK (char_length(base_currency) = 3);

-- Updated_at trigger
CREATE TRIGGER transactions_set_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
