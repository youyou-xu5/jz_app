import { createClient } from "@/lib/supabase/server";
import { getAccountsGroupedByCurrency, type AccountWithBalance } from "@/features/accounts/queries";
import { getLatestRate, getBaseCurrency } from "@/features/exchange-rates/queries";
import { getMonthlySummary, getRecentTransactions } from "@/features/transactions/queries";
import { getCurrentYearMonth } from "@/lib/utils/date";
import Decimal from "decimal.js";
import type { Transaction } from "@/types/database";

/**
 * Total assets: sum of all account balances, converted to base currency.
 * Uses the LATEST exchange rate (not historical snapshots).
 */
export async function getTotalAssets(): Promise<{
  totalBase: string;
  byCurrency: { currency: string; balance: string; baseEquivalent: string }[];
  rate: string | null;
  baseCurrency: string;
  quoteCurrency: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { totalBase: "0", byCurrency: [], rate: null, baseCurrency: "CNY", quoteCurrency: "THB" };
  }

  const { currencies } = await getAccountsGroupedByCurrency();
  const baseCurrency = await getBaseCurrency();
  const quoteCurrency = baseCurrency === "CNY" ? "THB" : "CNY";

  // Get latest rate for conversion
  const rateData = await getLatestRate(baseCurrency, quoteCurrency);
  const rate = rateData?.rate ?? null;

  let totalBase = new Decimal(0);
  const byCurrency: { currency: string; balance: string; baseEquivalent: string }[] = [];

  for (const group of currencies) {
    const groupBalance = group.accounts.reduce(
      (sum, acc) => sum.plus(new Decimal(acc.current_balance)),
      new Decimal(0)
    );

    let baseEquivalent: Decimal;
    if (group.currency === baseCurrency) {
      baseEquivalent = groupBalance;
    } else if (rate) {
      // quote -> base: divide by rate
      baseEquivalent = groupBalance.dividedBy(new Decimal(rate));
    } else {
      // No rate available, can't convert
      baseEquivalent = new Decimal(0);
    }

    totalBase = totalBase.plus(baseEquivalent);
    byCurrency.push({
      currency: group.currency,
      balance: groupBalance.toFixed(4),
      baseEquivalent: baseEquivalent.toFixed(4),
    });
  }

  return {
    totalBase: totalBase.toFixed(4),
    byCurrency,
    rate,
    baseCurrency,
    quoteCurrency,
  };
}

/**
 * Get category-based expense breakdown for the current month.
 * Returns top categories by amount.
 */
export async function getMonthlyCategoryStats(): Promise<{
  expenseByCategory: { categoryId: string; categoryName: string; icon: string | null; color: string | null; amount: string; percentage: number }[];
  totalExpense: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { expenseByCategory: [], totalExpense: "0" };

  const { year, month } = getCurrentYearMonth();
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const end = `${year}-${String(month).padStart(2, "0")}-31`;

  const { data: transactions, error } = await supabase
    .from("transactions")
    .select("amount, base_amount, category_id, currency")
    .eq("user_id", user.id)
    .eq("transaction_type", "expense")
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (error || !transactions) return { expenseByCategory: [], totalExpense: "0" };

  // Fetch categories
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name, icon, color")
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  const categoryMap: Record<string, { name: string; icon: string | null; color: string | null }> = {};
  for (const c of categories ?? []) {
    categoryMap[c.id] = { name: c.name, icon: c.icon, color: c.color };
  }

  // Aggregate by category
  const amountByCategory: Record<string, { total: Decimal; currency: string }> = {};
  let totalExpense = new Decimal(0);

  for (const t of transactions) {
    const baseAmt = new Decimal(t.base_amount);
    totalExpense = totalExpense.plus(baseAmt);

    if (t.category_id) {
      if (!amountByCategory[t.category_id]) {
        amountByCategory[t.category_id] = { total: new Decimal(0), currency: t.currency };
      }
      amountByCategory[t.category_id].total = amountByCategory[t.category_id].total.plus(baseAmt);
    }
  }

  // Build sorted result
  const expenseByCategory = Object.entries(amountByCategory)
    .map(([categoryId, { total }]) => {
      const cat = categoryMap[categoryId];
      return {
        categoryId,
        categoryName: cat?.name ?? "未分类",
        icon: cat?.icon ?? null,
        color: cat?.color ?? null,
        amount: total.toFixed(4),
        percentage: totalExpense.gt(0)
          ? total.dividedBy(totalExpense).times(100).toDecimalPlaces(1).toNumber()
          : 0,
      };
    })
    .sort((a, b) => Number(b.amount) - Number(a.amount))
    .slice(0, 8);

  return {
    expenseByCategory,
    totalExpense: totalExpense.toFixed(4),
  };
}

/**
 * Get dashboard data — all the data needed for the dashboard page.
 */
export async function getDashboardData(): Promise<{
  totalAssets: Awaited<ReturnType<typeof getTotalAssets>>;
  monthlySummary: Awaited<ReturnType<typeof getMonthlySummary>>;
  categoryStats: Awaited<ReturnType<typeof getMonthlyCategoryStats>>;
  recentTransactions: (Transaction & { account_name?: string; category_name?: string | null })[];
  accounts: AccountWithBalance[];
  baseCurrency: string;
}> {
  const [totalAssets, monthlySummary, categoryStats, recentTxns, { currencies }] = await Promise.all([
    getTotalAssets(),
    getMonthlySummary(),
    getMonthlyCategoryStats(),
    getRecentTransactions(10),
    getAccountsGroupedByCurrency(),
  ]);

  // Fetch account names and category names for recent transactions
  const supabase = await createClient();
  const allAccounts = currencies.flatMap((c) => c.accounts);
  const accountMap: Record<string, string> = {};
  for (const a of allAccounts) {
    accountMap[a.id] = a.name;
  }

  // Fetch category names for transactions
  const categoryIds = recentTxns
    .map((t) => t.category_id)
    .filter((id): id is string => id !== null);
  const categoryMap: Record<string, string> = {};

  if (categoryIds.length > 0) {
    const { data: cats } = await supabase
      .from("categories")
      .select("id, name")
      .in("id", categoryIds);
    for (const c of cats ?? []) {
      categoryMap[c.id] = c.name;
    }
  }

  const enrichedTransactions = recentTxns.map((t) => ({
    ...t,
    account_name: accountMap[t.account_id] ?? "未知账户",
    category_name: t.category_id ? categoryMap[t.category_id] ?? "未分类" : null,
  }));

  return {
    totalAssets,
    monthlySummary,
    categoryStats,
    recentTransactions: enrichedTransactions,
    accounts: allAccounts,
    baseCurrency: totalAssets.baseCurrency,
  };
}
