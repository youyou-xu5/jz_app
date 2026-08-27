import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/utils/date";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));

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

  return NextResponse.json({
    data,
    totalIncome: Number(totalIncome.toFixed(2)),
    totalExpense: Number(totalExpense.toFixed(2)),
  });
}
