import { createClient } from "@/lib/supabase/server";
import { getCurrentDate, getMonthRange, getCurrentYearMonth } from "@/lib/utils/date";
import type { Transaction, Account, Category } from "@/types/database";

/**
 * Transaction enriched with account/category names.
 */
export interface TransactionWithDetails extends Transaction {
  account_name?: string;
  category_name?: string | null;
}

/**
 * Get transactions for a specific month with account and category names.
 */
export async function getTransactionsByMonth(
  year?: number,
  month?: number
): Promise<TransactionWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { year: y, month: m } = getCurrentYearMonth();
  const targetYear = year ?? y;
  const targetMonth = month ?? m;
  const { start, end } = getMonthRange(targetYear, targetMonth);

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  // Enrich with account and category names
  return enrichTransactions(data as Transaction[], user.id, supabase);
}

/**
 * Get recent transactions for dashboard.
 */
export async function getRecentTransactions(
  limit: number = 10
): Promise<TransactionWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  return enrichTransactions(data as Transaction[], user.id, supabase);
}

/**
 * Get transactions with filters.
 */
export async function getFilteredTransactions(filters: {
  year: number;
  month: number;
  transactionType?: string;
  accountId?: string;
  categoryId?: string;
  currency?: string;
  search?: string;
}): Promise<TransactionWithDetails[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { start, end } = getMonthRange(filters.year, filters.month);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (filters.transactionType && filters.transactionType !== "all") {
    query = query.eq("transaction_type", filters.transactionType);
  }
  if (filters.accountId && filters.accountId !== "all") {
    query = query.eq("account_id", filters.accountId);
  }
  if (filters.categoryId && filters.categoryId !== "all") {
    query = query.eq("category_id", filters.categoryId);
  }
  if (filters.currency && filters.currency !== "all") {
    query = query.eq("currency", filters.currency);
  }
  if (filters.search) {
    query = query.or(`note.ilike.%${filters.search}%`);
  }

  const { data, error } = await query
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return enrichTransactions(data as Transaction[], user.id, supabase);
}

/**
 * Enrich transaction records with account_name and category_name.
 */
async function enrichTransactions(
  transactions: Transaction[],
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<TransactionWithDetails[]> {
  if (transactions.length === 0) return [];

  const accountIds = [...new Set(transactions.map((t) => t.account_id))];
  const categoryIds = [...new Set(
    transactions.map((t) => t.category_id).filter((id): id is string => id !== null)
  )];

  const [accountsRes, categoriesRes] = await Promise.all([
    supabase.from("accounts").select("id, name").in("id", accountIds),
    categoryIds.length > 0
      ? supabase
          .from("categories")
          .select("id, name")
          .or(`user_id.is.null,user_id.eq.${userId}`)
          .in("id", categoryIds)
      : Promise.resolve({ data: [] }),
  ]);

  const accountMap: Record<string, string> = {};
  for (const a of accountsRes.data ?? []) {
    accountMap[a.id] = a.name;
  }

  const categoryMap: Record<string, string> = {};
  for (const c of categoriesRes.data ?? []) {
    categoryMap[c.id] = c.name;
  }

  return transactions.map((t) => ({
    ...t,
    account_name: accountMap[t.account_id] ?? "未知账户",
    category_name: t.category_id ? categoryMap[t.category_id] ?? "未分类" : null,
  }));
}

/**
 * Get monthly income/expense summary for dashboard.
 */
export async function getMonthlySummary(): Promise<{
  incomeBase: string;
  expenseBase: string;
  incomeByCurrency: { currency: string; amount: string }[];
  expenseByCurrency: { currency: string; amount: string }[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      incomeBase: "0",
      expenseBase: "0",
      incomeByCurrency: [],
      expenseByCurrency: [],
    };

  const { year, month } = getCurrentYearMonth();
  const { start, end } = getMonthRange(year, month);

  const { data, error } = await supabase
    .from("transactions")
    .select("transaction_type, amount, currency, base_amount")
    .eq("user_id", user.id)
    .gte("transaction_date", start)
    .lte("transaction_date", end)
    .in("transaction_type", ["income", "expense"]);

  if (error || !data) {
    return {
      incomeBase: "0",
      expenseBase: "0",
      incomeByCurrency: [],
      expenseByCurrency: [],
    };
  }

  let incomeBase = 0;
  let expenseBase = 0;
  const incomeMap: Record<string, number> = {};
  const expenseMap: Record<string, number> = {};

  for (const t of data) {
    const amt = Number(t.amount);
    const baseAmt = Number(t.base_amount);
    if (t.transaction_type === "income") {
      incomeBase += baseAmt;
      incomeMap[t.currency] = (incomeMap[t.currency] ?? 0) + amt;
    } else {
      expenseBase += baseAmt;
      expenseMap[t.currency] = (expenseMap[t.currency] ?? 0) + amt;
    }
  }

  return {
    incomeBase: incomeBase.toFixed(4),
    expenseBase: expenseBase.toFixed(4),
    incomeByCurrency: Object.entries(incomeMap).map(([currency, amount]) => ({
      currency,
      amount: amount.toFixed(4),
    })),
    expenseByCurrency: Object.entries(expenseMap).map(([currency, amount]) => ({
      currency,
      amount: amount.toFixed(4),
    })),
  };
}

/**
 * Get accounts and categories for transaction form.
 */
export async function getFormData(): Promise<{
  accounts: Account[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  baseCurrency: string;
  latestRate: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return {
      accounts: [],
      expenseCategories: [],
      incomeCategories: [],
      baseCurrency: "CNY",
      latestRate: "4.8",
    };

  const [accountsRes, categoriesRes, profileRes] = await Promise.all([
    supabase
      .from("accounts")
      .select("*")
      .eq("user_id", user.id)
      .eq("is_archived", false)
      .order("sort_order"),
    supabase
      .from("categories")
      .select("*")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq("is_archived", false)
      .order("sort_order"),
    supabase.from("profiles").select("base_currency").eq("id", user.id).single(),
  ]);

  const baseCurrency = profileRes.data?.base_currency ?? "CNY";
  const quoteCurrency = baseCurrency === "CNY" ? "THB" : "CNY";

  const { data: rateData } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();

  return {
    accounts: accountsRes.data ?? [],
    expenseCategories: (categoriesRes.data ?? []).filter((c) => c.type === "expense"),
    incomeCategories: (categoriesRes.data ?? []).filter((c) => c.type === "income"),
    baseCurrency,
    latestRate: rateData?.rate ?? "4.8",
  };
}
