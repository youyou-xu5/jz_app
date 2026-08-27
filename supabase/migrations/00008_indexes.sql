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
