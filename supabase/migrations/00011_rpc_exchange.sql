-- Migration: 00011_rpc_exchange
-- Description: create_exchange RPC function
-- Guarantees atomic creation of exchange record + 2 exchange transactions
-- Also provides delete_exchange for atomic deletion

-- =============================================================
-- CREATE EXCHANGE RPC
-- =============================================================
-- Creates:
--   1. An exchanges record (metadata)
--   2. Two "exchange" type transactions (linked by exchange_id)
--      - From account: -from_amount (transfer-out in from_currency)
--      - To account: +to_amount (transfer-in in to_currency)
--
-- The rate direction is always: 1 base_currency = rate × quote_currency
-- actual_rate is calculated as:
--   If from = base, to = quote: actual_rate = to_amount / from_amount
--   If from = quote, to = base: actual_rate = from_amount / to_amount
--
-- Each transaction stores its own exchange_rate and base_amount:
--   - Transaction in base currency: rate = 1, base_amount = amount
--   - Transaction in quote currency: rate = actual_rate, base_amount = amount / actual_rate

CREATE OR REPLACE FUNCTION public.create_exchange(
  p_from_account_id  uuid,
  p_to_account_id    uuid,
  p_from_currency    varchar(3),
  p_to_currency      varchar(3),
  p_from_amount      numeric(18,4),
  p_to_amount        numeric(18,4),
  p_reference_rate   numeric(18,8) DEFAULT NULL,
  p_actual_rate      numeric(18,8),
  p_fee_amount       numeric(18,4) DEFAULT NULL,
  p_fee_currency     varchar(3) DEFAULT NULL,
  p_base_currency    varchar(3),
  p_transaction_date date,
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
  -- Transaction 2: TO account (positive amount in to_currency)
  --
  -- Rate direction: 1 base = rate × quote
  --   - If from_currency = base_currency: tx1 rate=1, base_amount = -from_amount
  --     tx2 (to_currency = quote): rate = actual_rate, base_amount = to_amount / actual_rate
  --
  --   - If from_currency = quote, to_currency = base: tx1 rate = actual_rate, base_amount = from_amount / actual_rate
  --     tx2 (to_currency = base): rate=1, base_amount = to_amount

  -- === Transaction 1: FROM account (transfer-out, negative) ===
  IF p_from_currency = p_base_currency THEN
    -- from is base currency: rate = 1
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
    -- from is quote currency: rate = actual_rate, base_amount = amount / rate
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

  -- === Transaction 2: TO account (transfer-in, positive) ===
  IF p_to_currency = p_base_currency THEN
    -- to is base currency: rate = 1
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
    -- to is quote currency: rate = actual_rate, base_amount = amount / rate
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
-- Atomically deletes an exchange record AND its two transactions.
-- @param p_exchange_id  The exchange to delete
-- @returns               JSON with status

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

  -- Verify the exchange belongs to the user
  SELECT count(*) INTO v_count
  FROM public.exchanges
  WHERE id = p_exchange_id AND user_id = v_user_id;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Exchange not found or not owned by user';
  END IF;

  -- Verify transaction count
  SELECT count(*) INTO v_count
  FROM public.transactions
  WHERE exchange_id = p_exchange_id AND user_id = v_user_id;

  IF v_count != 2 THEN
    RAISE EXCEPTION 'Exchange has % transactions, expected 2. Data inconsistency.', v_count;
  END IF;

  -- Delete transactions first (they reference exchanges via FK)
  DELETE FROM public.transactions
  WHERE exchange_id = p_exchange_id AND user_id = v_user_id;

  -- Delete the exchange record
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
  numeric, numeric, numeric, varchar, varchar, date, text
) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_exchange(uuid) TO authenticated;
