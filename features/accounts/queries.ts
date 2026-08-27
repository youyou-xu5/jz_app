import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/types/database";

export interface AccountWithBalance extends Account {
  current_balance: string;
  transaction_count: number;
}

/**
 * Get all accounts for the current user, grouped by currency.
 *
 * current_balance = initial_balance + SUM(transactions.amount)
 *
 * Two code paths:
 *   1. RPC path: get_account_balances() returns the FULL balance
 *      (initial_balance already included). Use it directly.
 *   2. Fallback path: manually sum transactions, then add initial_balance.
 *
 * In BOTH paths, initial_balance is added exactly once.
 */
export async function getAccountsGroupedByCurrency(): Promise<{
  currencies: { currency: string; accounts: AccountWithBalance[] }[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { currencies: [] };

  const { data: accounts, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !accounts) return { currencies: [] };

  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return { currencies: [] };

  // Try RPC first — returns balance = initial_balance + SUM(amount) (already final)
  const { data: rpcBalances, error: rpcError } = await supabase.rpc(
    "get_account_balances",
    { p_user_id: user.id },
  );

  // Build balance and count maps
  let rpcSucceeded = false;

  // Map: account_id -> { sumOfTransactions (NOT including initial_balance), count }
  const txnSumMap: Record<string, number> = {};
  const txnCountMap: Record<string, number> = {};

  if (!rpcError && rpcBalances) {
    // RPC succeeded — each row has { account_id, balance, transaction_count }
    // balance already = initial_balance + SUM(transactions.amount)
    // We store the FINAL balance directly, no need to add initial_balance later
    rpcSucceeded = true;
    for (const row of rpcBalances) {
      // Store the FINAL balance (already includes initial_balance)
      txnSumMap[row.account_id] = Number(row.balance);
      txnCountMap[row.account_id] = Number(row.transaction_count);
    }
  }

  if (!rpcSucceeded) {
    // Fallback: fetch all transactions and sum manually
    // balanceMap will contain ONLY the sum of transactions (no initial_balance)
    const { data: txns } = await supabase
      .from("transactions")
      .select("account_id, amount")
      .in("account_id", accountIds);

    if (txns) {
      for (const t of txns) {
        txnSumMap[t.account_id] = (txnSumMap[t.account_id] ?? 0) + Number(t.amount);
        txnCountMap[t.account_id] = (txnCountMap[t.account_id] ?? 0) + 1;
      }
    }
  }

  const accountsWithBalance: AccountWithBalance[] = accounts.map((a) => {
    let total: number;

    if (rpcSucceeded) {
      // RPC returned the FINAL balance (initial_balance + SUM(transactions.amount))
      // Use it directly — do NOT add initial_balance again
      total = txnSumMap[a.id] ?? Number(a.initial_balance);
    } else {
      // Fallback: txnSumMap contains only SUM(transactions.amount)
      // Must add initial_balance exactly once
      total = Number(a.initial_balance) + (txnSumMap[a.id] ?? 0);
    }

    return {
      ...a,
      current_balance: total.toFixed(4),
      transaction_count: txnCountMap[a.id] ?? 0,
    };
  });

  // Group by currency
  const currencyMap: Record<string, AccountWithBalance[]> = {};
  for (const a of accountsWithBalance) {
    if (!currencyMap[a.currency]) currencyMap[a.currency] = [];
    currencyMap[a.currency].push(a);
  }

  const currencies = Object.entries(currencyMap).map(([currency, accts]) => ({
    currency,
    accounts: accts,
  }));

  return { currencies };
}

/**
 * Get all accounts (including archived) for settings page.
 */
export async function getAllAccounts(): Promise<Account[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", user.id)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data;
}

/**
 * Get a single account by id.
 */
export async function getAccountById(id: string): Promise<Account | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data;
}
