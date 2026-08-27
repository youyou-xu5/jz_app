-- Migration: 00001_profiles
-- Description: Create profiles table + handle_new_user trigger

-- =============================================================
-- PROFILES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name text,
  base_currency varchar(3) NOT NULL DEFAULT 'CNY',
  timezone     text NOT NULL DEFAULT 'Asia/Bangkok',
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profile, 1:1 with auth.users';

-- =============================================================
-- AUTO-CREATE PROFILE ON SIGNUP
-- =============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, base_currency, timezone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    'CNY',
    'Asia/Bangkok'
  );
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists, then create
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================
-- UPDATED_AT TRIGGER
-- =============================================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER profiles_set_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
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
-- Migration: 00003_categories
-- Description: Create categories table with self-referencing parent_id

-- =============================================================
-- CATEGORIES TABLE
-- =============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  name        text NOT NULL,
  type        text NOT NULL,
  icon        text,
  color       text,
  parent_id   uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,
  is_archived boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.categories IS 'Transaction categories. System categories have user_id = NULL';
COMMENT ON COLUMN public.categories.type IS 'expense or income';
COMMENT ON COLUMN public.categories.is_system IS 'System categories are shared across all users';

-- CHECK: parent_id != id (prevent self-reference)
ALTER TABLE public.categories
  ADD CONSTRAINT categories_no_self_reference
  CHECK (parent_id IS NULL OR parent_id != id);

-- CHECK: type must be expense or income
ALTER TABLE public.categories
  ADD CONSTRAINT categories_type_check
  CHECK (type IN ('expense', 'income'));
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
-- Migration: 00007_rls_policies
-- Description: Enable RLS on all tables + create policies
-- CRITICAL: RLS must never be disabled. All data access is scoped by auth.uid() = user_id.

-- =============================================================
-- ENABLE RLS
-- =============================================================
ALTER TABLE public.profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exchanges      ENABLE ROW LEVEL SECURITY;

-- =============================================================
-- PROFILES POLICIES
-- =============================================================
CREATE POLICY "profiles_select_own"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- No DELETE policy: profiles are deleted via auth.users CASCADE

-- =============================================================
-- ACCOUNTS POLICIES
-- =============================================================
CREATE POLICY "accounts_select_own"
  ON public.accounts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "accounts_insert_own"
  ON public.accounts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_update_own"
  ON public.accounts FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "accounts_delete_own"
  ON public.accounts FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- CATEGORIES POLICIES
-- System categories (user_id IS NULL) are visible to all.
-- User categories are scoped by user_id.
-- =============================================================
CREATE POLICY "categories_select_all"
  ON public.categories FOR SELECT
  USING (user_id IS NULL OR auth.uid() = user_id);

CREATE POLICY "categories_insert_own"
  ON public.categories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_update_own"
  ON public.categories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "categories_delete_own"
  ON public.categories FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- TRANSACTIONS POLICIES
-- =============================================================
CREATE POLICY "transactions_select_own"
  ON public.transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "transactions_insert_own"
  ON public.transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_update_own"
  ON public.transactions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "transactions_delete_own"
  ON public.transactions FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- EXCHANGE_RATES POLICIES
-- =============================================================
CREATE POLICY "exchange_rates_select_own"
  ON public.exchange_rates FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exchange_rates_insert_own"
  ON public.exchange_rates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exchange_rates_update_own"
  ON public.exchange_rates FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exchange_rates_delete_own"
  ON public.exchange_rates FOR DELETE
  USING (auth.uid() = user_id);

-- =============================================================
-- EXCHANGES POLICIES
-- =============================================================
CREATE POLICY "exchanges_select_own"
  ON public.exchanges FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "exchanges_insert_own"
  ON public.exchanges FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exchanges_update_own"
  ON public.exchanges FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "exchanges_delete_own"
  ON public.exchanges FOR DELETE
  USING (auth.uid() = user_id);
-- Migration: 00008_indexes
-- Description: Performance indexes on frequently queried columns
-- Only create indexes that serve real query patterns.

-- =============================================================
-- TRANSACTIONS INDEXES
-- =============================================================

-- Dashboard: get user's transactions for current month
CREATE INDEX idx_transactions_user_date
  ON public.transactions (user_id, transaction_date DESC);

-- Account page: calculate account balance
CREATE INDEX idx_transactions_user_account
  ON public.transactions (user_id, account_id);

-- Category statistics
CREATE INDEX idx_transactions_user_category
  ON public.transactions (user_id, category_id)
  WHERE category_id IS NOT NULL;

-- Transfer lookup: find paired transaction
CREATE INDEX idx_transactions_transfer_group
  ON public.transactions (transfer_group_id)
  WHERE transfer_group_id IS NOT NULL;

-- Exchange lookup: find paired transactions
CREATE INDEX idx_transactions_exchange_id
  ON public.transactions (exchange_id)
  WHERE exchange_id IS NOT NULL;

-- =============================================================
-- EXCHANGE_RATES INDEXES
-- =============================================================

-- Get latest rate for a currency pair
CREATE INDEX idx_exchange_rates_user_pair_effective
  ON public.exchange_rates (user_id, base_currency, quote_currency, effective_at DESC);

-- =============================================================
-- EXCHANGES INDEXES
-- =============================================================

-- List user's exchanges by date
CREATE INDEX idx_exchanges_user_date
  ON public.exchanges (user_id, transaction_date DESC);

-- =============================================================
-- ACCOUNTS INDEXES
-- =============================================================

-- List user's accounts sorted
CREATE INDEX idx_accounts_user_sort
  ON public.accounts (user_id, sort_order);

-- =============================================================
-- CATEGORIES INDEXES
-- =============================================================

-- List categories by type for a user (including system)
CREATE INDEX idx_categories_type_sort
  ON public.categories (type, sort_order);
-- Migration: 00009_additional_constraints
-- Description: Additional CHECK constraints and business rules
-- (Some constraints are already in table definitions; this adds cross-table rules)

-- =============================================================
-- TRANSACTION TYPE vs CATEGORY CONSISTENCY
-- =============================================================
-- Expense and income transactions should have a category (nullable for flexibility)
-- Transfer and exchange transactions should NOT have a category

-- CREATE CONSTRAINT: transfer/exchange transactions must not have category_id
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_exchange_no_category
  CHECK (
    (transaction_type NOT IN ('transfer', 'exchange')) OR
    (category_id IS NULL)
  );

-- =============================================================
-- TRANSACTION TYPE vs TRANSFER_GROUP_ID CONSISTENCY
-- =============================================================
-- Only transfer transactions have transfer_group_id
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_transfer_group_only_for_transfer
  CHECK (
    (transaction_type = 'transfer') OR
    (transfer_group_id IS NULL)
  );

-- =============================================================
-- TRANSACTION TYPE vs EXCHANGE_ID CONSISTENCY
-- =============================================================
-- Only exchange transactions have exchange_id
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_exchange_id_only_for_exchange
  CHECK (
    (transaction_type = 'exchange') OR
    (exchange_id IS NULL)
  );

-- =============================================================
-- ACCOUNT CURRENCY CONSISTENCY
-- =============================================================
-- For transfer transactions: the account's currency must match the transaction currency
-- (This is enforced at the application layer since cross-table CHECKs are not practical in PG)
-- For exchange transactions: each transaction's currency must match the respective account

-- =============================================================
-- EXCHANGE CONSISTENCY
-- =============================================================
-- fee_currency, if present, must be either from_currency or to_currency
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_fee_currency_valid
  CHECK (
    fee_currency IS NULL OR
    fee_currency = from_currency OR
    fee_currency = to_currency
  );

-- fee_amount, if present, must be positive
ALTER TABLE public.exchanges
  ADD CONSTRAINT exchanges_fee_amount_positive
  CHECK (
    fee_amount IS NULL OR
    fee_amount > 0
  );

-- =============================================================
-- ACCOUNT_TYPE CHECK
-- =============================================================
ALTER TABLE public.accounts
  ADD CONSTRAINT accounts_type_check
  CHECK (
    account_type IS NULL OR
    account_type IN ('cash', 'bank', 'ewallet', 'other')
  );
-- Migration: 00010_rpc_transfer
-- Description: create_transfer RPC function
-- Guarantees atomic creation of two transfer transactions (transfer_group_id shared)
-- Also provides delete_transfer for atomic deletion

-- =============================================================
-- CREATE TRANSFER RPC
-- =============================================================
-- Creates two "transfer" type transactions atomically.
-- Both share the same transfer_group_id.
-- Account A: -amount (transfer-out)
-- Account B: +amount (transfer-in)
--
-- @param p_from_account_id  Source account (gets negative amount)
-- @param p_to_account_id    Destination account (gets positive amount)
-- @param p_amount           Positive amount to transfer
-- @param p_currency         Currency code (must match both accounts)
-- @param p_transaction_date Date of transfer
-- @param p_note             Optional note
-- @returns                  JSON with transfer_group_id

CREATE OR REPLACE FUNCTION public.create_transfer(
  p_from_account_id uuid,
  p_to_account_id   uuid,
  p_amount          numeric(18,4),
  p_currency        varchar(3),
  p_transaction_date date,
  p_note            text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_group_id       uuid := gen_random_uuid();
  v_from_account    record;
  v_to_account      record;
  v_profile         record;
  v_base_currency   varchar(3);
BEGIN
  -- Validate user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be positive, got %', p_amount;
  END IF;

  -- Validate different accounts
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'From and to accounts must be different';
  END IF;

  -- Fetch accounts and verify ownership + currency
  SELECT * INTO v_from_account FROM public.accounts WHERE id = p_from_account_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found or not owned by user';
  END IF;

  SELECT * INTO v_to_account FROM public.accounts WHERE id = p_to_account_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination account not found or not owned by user';
  END IF;

  -- Both accounts must have the same currency for transfer
  IF v_from_account.currency != p_currency OR v_to_account.currency != p_currency THEN
    RAISE EXCEPTION 'Account currency mismatch. Transfer requires same currency. Account A: %, Account B: %, Transfer: %',
      v_from_account.currency, v_to_account.currency, p_currency;
  END IF;
  IF v_from_account.currency != v_to_account.currency THEN
    RAISE EXCEPTION 'Cannot transfer between different currency accounts. Use exchange instead. A: %, B: %',
      v_from_account.currency, v_to_account.currency;
  END IF;

  -- Get user's base_currency
  SELECT base_currency INTO v_base_currency FROM public.profiles WHERE id = v_user_id;
  IF v_base_currency IS NULL THEN
    v_base_currency := 'CNY';
  END IF;

  -- Validate currency matches base or rate = 1
  IF p_currency = v_base_currency THEN
    -- Same as base: rate = 1, base_amount = amount
    -- Insert transfer-out (negative)
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, transfer_group_id
    ) VALUES (
      v_user_id, p_from_account_id, 'transfer', NULL,
      -p_amount, p_currency, v_base_currency, 1, -p_amount,
      p_transaction_date, p_note, v_group_id
    );

    -- Insert transfer-in (positive)
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, transfer_group_id
    ) VALUES (
      v_user_id, p_to_account_id, 'transfer', NULL,
      p_amount, p_currency, v_base_currency, 1, p_amount,
      p_transaction_date, p_note, v_group_id
    );
  ELSE
    -- Different currency from base: this shouldn't happen for same-currency transfer
    -- But if base_currency is different from transfer currency, rate = 1 still applies
    -- because both accounts have the same currency
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, transfer_group_id
    ) VALUES (
      v_user_id, p_from_account_id, 'transfer', NULL,
      -p_amount, p_currency, v_base_currency, 1, -p_amount,
      p_transaction_date, p_note, v_group_id
    );

    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, transfer_group_id
    ) VALUES (
      v_user_id, p_to_account_id, 'transfer', NULL,
      p_amount, p_currency, v_base_currency, 1, p_amount,
      p_transaction_date, p_note, v_group_id
    );
  END IF;

  RETURN json_build_object(
    'transfer_group_id', v_group_id,
    'status', 'success'
  );
END;
$$;

-- =============================================================
-- DELETE TRANSFER RPC
-- =============================================================
-- Atomically deletes both transactions in a transfer group.
-- @param p_group_id  The transfer_group_id to delete
-- @returns            JSON with deleted count

CREATE OR REPLACE FUNCTION public.delete_transfer(
  p_group_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_count     integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the transfer belongs to the user
  SELECT count(*) INTO v_count
  FROM public.transactions
  WHERE transfer_group_id = p_group_id AND user_id = v_user_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Transfer not found or not owned by user';
  END IF;

  IF v_count != 2 THEN
    RAISE EXCEPTION 'Transfer group has % transactions, expected 2. Data inconsistency.', v_count;
  END IF;

  -- Delete both
  DELETE FROM public.transactions
  WHERE transfer_group_id = p_group_id AND user_id = v_user_id;

  RETURN json_build_object(
    'status', 'success',
    'deleted_count', v_count
  );
END;
$$;

-- =============================================================
-- GRANT EXECUTE
-- =============================================================
GRANT EXECUTE ON FUNCTION public.create_transfer(uuid, uuid, numeric, varchar, date, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_transfer(uuid) TO authenticated;
-- Migration: 00011_rpc_exchange
-- Description: create_exchange RPC function
-- Guarantees atomic creation of exchange record + 2 exchange transactions

CREATE OR REPLACE FUNCTION public.create_exchange(
  -- ============ 必填参数（无默认值，必须按顺序提供）============
  p_from_account_id  uuid,
  p_to_account_id    uuid,
  p_from_currency    varchar(3),
  p_to_currency      varchar(3),
  p_from_amount      numeric(18,4),
  p_to_amount        numeric(18,4),
  p_actual_rate      numeric(18,8),
  p_base_currency    varchar(3),
  p_transaction_date date,
  -- ============ 可选参数（有默认值，可省略）============
  p_reference_rate   numeric(18,8) DEFAULT NULL,
  p_fee_amount       numeric(18,4) DEFAULT NULL,
  p_fee_currency     varchar(3) DEFAULT NULL,
  p_note             text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id         uuid := auth.uid();
  v_exchange_id     uuid := gen_random_uuid();
  v_from_account     record;
  v_to_account       record;
  v_actual_rate      numeric(18,8);
  v_from_base_amount numeric(18,4);
  v_to_base_amount   numeric(18,4);
BEGIN
  -- Validate user
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Validate amounts
  IF p_from_amount <= 0 THEN
    RAISE EXCEPTION 'from_amount must be positive, got %', p_from_amount;
  END IF;
  IF p_to_amount <= 0 THEN
    RAISE EXCEPTION 'to_amount must be positive, got %', p_to_amount;
  END IF;

  -- Validate different accounts
  IF p_from_account_id = p_to_account_id THEN
    RAISE EXCEPTION 'From and to accounts must be different';
  END IF;

  -- Validate different currencies
  IF p_from_currency = p_to_currency THEN
    RAISE EXCEPTION 'From and to currencies must be different. Use transfer for same-currency';
  END IF;

  -- Validate actual_rate
  IF p_actual_rate <= 0 THEN
    RAISE EXCEPTION 'actual_rate must be positive, got %', p_actual_rate;
  END IF;

  -- Fetch accounts and verify ownership + currency match
  SELECT * INTO v_from_account FROM public.accounts WHERE id = p_from_account_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source account not found or not owned by user';
  END IF;
  IF v_from_account.currency != p_from_currency THEN
    RAISE EXCEPTION 'Source account currency (%) does not match from_currency (%)', v_from_account.currency, p_from_currency;
  END IF;

  SELECT * INTO v_to_account FROM public.accounts WHERE id = p_to_account_id AND user_id = v_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Destination account not found or not owned by user';
  END IF;
  IF v_to_account.currency != p_to_currency THEN
    RAISE EXCEPTION 'Destination account currency (%) does not match to_currency (%)', v_to_account.currency, p_to_currency;
  END IF;

  -- =============================================================
  -- INSERT EXCHANGE RECORD
  -- =============================================================
  INSERT INTO public.exchanges (
    id, user_id, from_account_id, to_account_id,
    from_currency, to_currency, from_amount, to_amount,
    reference_rate, actual_rate, fee_amount, fee_currency,
    transaction_date, note
  ) VALUES (
    v_exchange_id, v_user_id, p_from_account_id, p_to_account_id,
    p_from_currency, p_to_currency, p_from_amount, p_to_amount,
    p_reference_rate, p_actual_rate, p_fee_amount, p_fee_currency,
    p_transaction_date, p_note
  );

  -- =============================================================
  -- INSERT TWO EXCHANGE TRANSACTIONS
  -- =============================================================
  -- Transaction 1: FROM account (negative amount in from_currency)
  IF p_from_currency = p_base_currency THEN
    v_from_base_amount := -p_from_amount;
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, exchange_id
    ) VALUES (
      v_user_id, p_from_account_id, 'exchange', NULL,
      -p_from_amount, p_from_currency, p_base_currency, 1, v_from_base_amount,
      p_transaction_date, p_note, v_exchange_id
    );
  ELSE
    v_from_base_amount := -(p_from_amount / p_actual_rate);
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, exchange_id
    ) VALUES (
      v_user_id, p_from_account_id, 'exchange', NULL,
      -p_from_amount, p_from_currency, p_base_currency, p_actual_rate, v_from_base_amount,
      p_transaction_date, p_note, v_exchange_id
    );
  END IF;

  -- Transaction 2: TO account (positive amount in to_currency)
  IF p_to_currency = p_base_currency THEN
    v_to_base_amount := p_to_amount;
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, exchange_id
    ) VALUES (
      v_user_id, p_to_account_id, 'exchange', NULL,
      p_to_amount, p_to_currency, p_base_currency, 1, v_to_base_amount,
      p_transaction_date, p_note, v_exchange_id
    );
  ELSE
    v_to_base_amount := p_to_amount / p_actual_rate;
    INSERT INTO public.transactions (
      user_id, account_id, transaction_type, category_id,
      amount, currency, base_currency, exchange_rate, base_amount,
      transaction_date, note, exchange_id
    ) VALUES (
      v_user_id, p_to_account_id, 'exchange', NULL,
      p_to_amount, p_to_currency, p_base_currency, p_actual_rate, v_to_base_amount,
      p_transaction_date, p_note, v_exchange_id
    );
  END IF;

  RETURN json_build_object(
    'exchange_id', v_exchange_id,
    'status', 'success'
  );
END;
$$;

-- =============================================================
-- DELETE EXCHANGE RPC
-- =============================================================
CREATE OR REPLACE FUNCTION public.delete_exchange(
  p_exchange_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id   uuid := auth.uid();
  v_count     integer;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.exchanges
  WHERE id = p_exchange_id AND user_id = v_user_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Exchange not found or not owned by user';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.transactions
  WHERE exchange_id = p_exchange_id AND user_id = v_user_id;

  IF v_count != 2 THEN
    RAISE EXCEPTION 'Exchange has % transactions, expected 2. Data inconsistency.', v_count;
  END IF;

  DELETE FROM public.transactions
  WHERE exchange_id = p_exchange_id AND user_id = v_user_id;

  DELETE FROM public.exchanges
  WHERE id = p_exchange_id AND user_id = v_user_id;

  RETURN json_build_object(
    'status', 'success',
    'deleted_transactions', v_count
  );
END;
$$;

-- =============================================================
-- GRANT EXECUTE
-- =============================================================
GRANT EXECUTE ON FUNCTION public.create_exchange(
  uuid, uuid, varchar, varchar, numeric, numeric,
  numeric, varchar, date, numeric, numeric, varchar, text
) TO authenticated;

GRANT EXECUTE ON FUNCTION public.delete_exchange(uuid) TO authenticated;-- Migration: 00012_seed_categories
-- Description: Seed default system categories (user_id = NULL, is_system = true)

-- =============================================================
-- DEFAULT EXPENSE CATEGORIES
-- =============================================================
INSERT INTO public.categories (user_id, name, type, icon, color, sort_order, is_system, is_archived)
VALUES
  (NULL, '餐饮',    'expense', 'utensils',   '#e24b4a',  1, true, false),
  (NULL, '交通',    'expense', 'car',         '#378add',  2, true, false),
  (NULL, '购物',    'expense', 'shopping-bag','#993556',  3, true, false),
  (NULL, '住房',    'expense', 'home',        '#534ab7',  4, true, false),
  (NULL, '水电',    'expense', 'zap',         '#ef9f27',  5, true, false),
  (NULL, '娱乐',    'expense', 'music',       '#7f77dd',  6, true, false),
  (NULL, '医疗',    'expense', 'heart-pulse', '#d85a30',  7, true, false),
  (NULL, '学习',    'expense', 'book-open',  '#1d9e75',  8, true, false),
  (NULL, '旅行',    'expense', 'plane',       '#185fa5',  9, true, false),
  (NULL, '宝宝',    'expense', 'baby',        '#ed93b1', 10, true, false),
  (NULL, '人情',    'expense', 'gift',        '#ba7517', 11, true, false),
  (NULL, '其他',    'expense', 'more-horizontal','#888780', 12, true, false)
ON CONFLICT DO NOTHING;

-- =============================================================
-- DEFAULT INCOME CATEGORIES
-- =============================================================
INSERT INTO public.categories (user_id, name, type, icon, color, sort_order, is_system, is_archived)
VALUES
  (NULL, '工资',      'income', 'briefcase',     '#1d9e75',  1, true, false),
  (NULL, '奖金',      'income', 'award',          '#3b6d11',  2, true, false),
  (NULL, '退款',      'income', 'rotate-ccw',     '#378add',  3, true, false),
  (NULL, '兼职',      'income', 'laptop',         '#534ab7',  4, true, false),
  (NULL, '投资收益',  'income', 'trending-up',    '#ef9f27',  5, true, false),
  (NULL, '其他收入',  'income', 'more-horizontal','#888780',  6, true, false)
ON CONFLICT DO NOTHING;
-- Migration: 00013_rpc_account_balances
-- Description: get_account_balances RPC for efficient balance calculation
-- Returns account_id, current balance, and transaction count

CREATE OR REPLACE FUNCTION public.get_account_balances(
  p_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  account_id uuid,
  balance numeric,
  transaction_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    a.id AS account_id,
    COALESCE(SUM(t.amount), 0) + a.initial_balance AS balance,
    COUNT(t.id) AS transaction_count
  FROM public.accounts a
  LEFT JOIN public.transactions t ON t.account_id = a.id
  WHERE
    (p_user_id IS NULL OR a.user_id = p_user_id)
    AND (p_user_id IS NULL OR t.user_id = p_user_id OR t.user_id IS NULL)
  GROUP BY a.id, a.initial_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balances(uuid) TO authenticated;