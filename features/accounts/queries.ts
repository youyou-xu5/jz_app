import { createClient } from "@/lib/supabase/server";
import type { Account } from "@/types/database";

export interface AccountWithBalance extends Account {
  current_balance: string;
  transaction_count: number;
}

/**
 * Get all accounts for the current user, grouped by currency.
 * Includes computed current_balance = initial_balance + SUM(transactions.amount).
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

  // Fetch all transaction sums per account
  const accountIds = accounts.map((a) => a.id);
  if (accountIds.length === 0) return { currencies: [] };

  const { data: balances, error: balanceError } = await supabase
    .rpc("get_account_balances", { p_user_id: user.id });

  // Fallback: compute manually if RPC doesn't exist yet
  let balanceMap: Record<string, string> = {};
  let countMap: Record<string, number> = {};

  if (!balanceError && balances) {
    for (const b of balances) {
      balanceMap[b.account_id] = b.balance;
      countMap[b.account_id] = b.transaction_count;
    }
  } else {
    // Manual fallback: fetch all transactions and sum
    const { data: txns } = await supabase
      .from("transactions")
      .select("account_id, amount")
      .in("account_id", accountIds);

    if (txns) {
      for (const t of txns) {
        const cur = balanceMap[t.account_id] ?? "0";
        balanceMap[t.account_id] = (Number(cur) + Number(t.amount)).toString();
        countMap[t.account_id] = (countMap[t.account_id] ?? 0) + 1;
      }
    }
  }

  const accountsWithBalance: AccountWithBalance[] = accounts.map((a) => {
    const sum = balanceMap[a.id] ?? "0";
    const initial = Number(a.initial_balance);
    const total = initial + Number(sum);
    return {
      ...a,
      current_balance: total.toFixed(4),
      transaction_count: countMap[a.id] ?? 0,
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
