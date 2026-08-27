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
