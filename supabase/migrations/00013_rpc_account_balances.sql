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
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

GRANT EXECUTE ON FUNCTION public.get_account_balances(uuid) TO authenticated;
