import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getMonthRange } from "@/lib/utils/date";
import type { Transaction } from "@/types/database";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get("year") ?? String(new Date().getFullYear()));
  const month = parseInt(searchParams.get("month") ?? String(new Date().getMonth() + 1));
  const type = searchParams.get("type") ?? "all";
  const accountId = searchParams.get("account") ?? "all";
  const categoryId = searchParams.get("category") ?? "all";
  const currency = searchParams.get("currency") ?? "all";
  const search = searchParams.get("search") ?? "";

  const { start, end } = getMonthRange(year, month);

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (type !== "all") {
    query = query.eq("transaction_type", type);
  }
  if (accountId !== "all") {
    query = query.eq("account_id", accountId);
  }
  if (categoryId !== "all") {
    query = query.eq("category_id", categoryId);
  }
  if (currency !== "all") {
    query = query.eq("currency", currency);
  }
  if (search) {
    query = query.or(`note.ilike.%${search}%`);
  }

  const { data, error } = await query
    .order("transaction_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Enrich with account and category names
  const transactions = data as Transaction[];
  const accountIds = [...new Set(transactions.map((t) => t.account_id))];
  const catIds = [...new Set(
    transactions.map((t) => t.category_id).filter((id): id is string => id !== null)
  )];

  const [accountsRes, categoriesRes] = await Promise.all([
    supabase.from("accounts").select("id, name").in("id", accountIds),
    catIds.length > 0
      ? supabase
          .from("categories")
          .select("id, name")
          .or(`user_id.is.null,user_id.eq.${user.id}`)
          .in("id", catIds)
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

  const enriched = transactions.map((t) => ({
    ...t,
    account_name: accountMap[t.account_id] ?? "未知账户",
    category_name: t.category_id ? categoryMap[t.category_id] ?? "未分类" : null,
  }));

  return NextResponse.json({ transactions: enriched });
}
