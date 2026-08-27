import { createClient } from "@/lib/supabase/server";
import { getMonthRange, getCurrentYearMonth } from "@/lib/utils/date";
import Decimal from "decimal.js";
import type { Category } from "@/types/database";

/**
 * Monthly trend: income vs expense for the last N months.
 */
export async function getMonthlyTrend(months: number = 6): Promise<{
  data: { year: number; month: number; label: string; income: number; expense: number; net: number }[];
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [] };

  const { year: currentYear, month: currentMonth } = getCurrentYearMonth();
  const result: { year: number; month: number; label: string; income: number; expense: number; net: number }[] = [];

  for (let i = months - 1; i >= 0; i--) {
    let y = currentYear;
    let m = currentMonth - i;
    while (m <= 0) {
      m += 12;
      y--;
    }

    const { start, end } = getMonthRange(y, m);
    const { data: txns } = await supabase
      .from("transactions")
      .select("transaction_type, base_amount")
      .eq("user_id", user.id)
      .in("transaction_type", ["income", "expense"])
      .gte("transaction_date", start)
      .lte("transaction_date", end);

    let income = 0;
    let expense = 0;
    for (const t of txns ?? []) {
      const amt = Number(t.base_amount);
      if (t.transaction_type === "income") income += amt;
      else expense += Math.abs(amt);
    }

    result.push({
      year: y,
      month: m,
      label: `${m}月`,
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      net: Number((income - expense).toFixed(2)),
    });
  }

  return { data: result };
}

/**
 * Yearly summary: monthly breakdown for a given year.
 */
export async function getYearlySummary(year: number): Promise<{
  data: { month: number; label: string; income: number; expense: number; net: number }[];
  totalIncome: number;
  totalExpense: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], totalIncome: 0, totalExpense: 0 };

  const data: { month: number; label: string; income: number; expense: number; net: number }[] = [];
  let totalIncome = 0;
  let totalExpense = 0;

  for (let m = 1; m <= 12; m++) {
    const { start, end } = getMonthRange(year, m);
    const { data: txns } = await supabase
      .from("transactions")
      .select("transaction_type, base_amount")
      .eq("user_id", user.id)
      .in("transaction_type", ["income", "expense"])
      .gte("transaction_date", start)
      .lte("transaction_date", end);

    let income = 0;
    let expense = 0;
    for (const t of txns ?? []) {
      const amt = Number(t.base_amount);
      if (t.transaction_type === "income") income += amt;
      else expense += Math.abs(amt);
    }

    totalIncome += income;
    totalExpense += expense;
    data.push({
      month: m,
      label: `${m}月`,
      income: Number(income.toFixed(2)),
      expense: Number(expense.toFixed(2)),
      net: Number((income - expense).toFixed(2)),
    });
  }

  return {
    data,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
  };
}

/**
 * Category breakdown for a given month.
 */
export async function getCategoryBreakdown(
  year: number,
  month: number,
  type: "expense" | "income" = "expense"
): Promise<{
  data: { name: string; value: number; color: string | null; percentage: number }[];
  total: number;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { data: [], total: 0 };

  const { start, end } = getMonthRange(year, month);

  const [txnRes, catRes] = await Promise.all([
    supabase
      .from("transactions")
      .select("base_amount, category_id")
      .eq("user_id", user.id)
      .eq("transaction_type", type)
      .gte("transaction_date", start)
      .lte("transaction_date", end),
    supabase
      .from("categories")
      .select("id, name, color")
      .or(`user_id.is.null,user_id.eq.${user.id}`)
      .eq("type", type),
  ]);

  const categoryMap: Record<string, { name: string; color: string | null }> = {};
  for (const c of catRes.data ?? []) {
    categoryMap[c.id] = { name: c.name, color: c.color };
  }

  const amountMap: Record<string, Decimal> = {};
  let total = new Decimal(0);

  for (const t of txnRes.data ?? []) {
    const baseAmt = new Decimal(t.base_amount);
    total = total.plus(baseAmt);
    const catId = t.category_id ?? "uncategorized";
    if (!amountMap[catId]) amountMap[catId] = new Decimal(0);
    amountMap[catId] = amountMap[catId].plus(baseAmt);
  }

  const data = Object.entries(amountMap)
    .map(([catId, amount]) => {
      const cat = categoryMap[catId];
      return {
        name: cat?.name ?? "未分类",
        value: Number(amount.toFixed(2)),
        color: cat?.color ?? null,
        percentage: total.gt(0)
          ? Number(amount.dividedBy(total).times(100).toDecimalPlaces(1).toString())
          : 0,
      };
    })
    .sort((a, b) => b.value - a.value);

  return {
    data,
    total: Number(total.toFixed(2)),
  };
}

/**
 * Get statistics page data for the current month.
 */
export async function getStatisticsData(): Promise<{
  monthlyTrend: Awaited<ReturnType<typeof getMonthlyTrend>>;
  categoryBreakdown: Awaited<ReturnType<typeof getCategoryBreakdown>>;
  currentYear: number;
  currentMonth: number;
  baseCurrency: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let baseCurrency = "CNY";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("base_currency")
      .eq("id", user.id)
      .single();
    baseCurrency = profile?.base_currency ?? "CNY";
  }

  const { year, month } = getCurrentYearMonth();

  const [monthlyTrend, categoryBreakdown] = await Promise.all([
    getMonthlyTrend(6),
    getCategoryBreakdown(year, month, "expense"),
  ]);

  return {
    monthlyTrend,
    categoryBreakdown,
    currentYear: year,
    currentMonth: month,
    baseCurrency,
  };
}
