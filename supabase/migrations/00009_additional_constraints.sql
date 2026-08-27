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
