-- Migration: 00013_rpc_account_balances
-- Description: get_account_balances RPC for efficient balance calculation
-- Returns account_id, current balance (initial_balance + SUM(transactions.amount)), and transaction count
--
-- IMPORTANT: balance = initial_balance + COALESCE(SUM(transactions.amount), 0)
-- The RPC returns the FULL current balance. Callers must NOT add initial_balance again.

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
    a.initial_balance + COALESCE(SUM(t.amount), 0) AS balance,
    COUNT(t.id) AS transaction_count
  FROM public.accounts a
  LEFT JOIN public.transactions t
    ON t.account_id = a.id
    AND (p_user_id IS NULL OR t.user_id = p_user_id)
  WHERE
    (p_user_id IS NULL OR a.user_id = p_user_id)
  GROUP BY a.id, a.initial_balance;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balances(uuid) TO authenticated;
