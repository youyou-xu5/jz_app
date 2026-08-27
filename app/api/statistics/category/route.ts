import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/utils/date";
import Decimal from "decimal.js";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const type = (searchParams.get("type") ?? "expense") as "expense" | "income";

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

  return NextResponse.json({
    data,
    total: Number(total.toFixed(2)),
  });
}
