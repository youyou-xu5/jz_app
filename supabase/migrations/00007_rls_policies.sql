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
