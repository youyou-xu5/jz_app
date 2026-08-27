"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Update user profile (base_currency, timezone, display_name).
 */
export async function updateProfileAction(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const baseCurrency = formData.get("base_currency") as string;
  const timezone = formData.get("timezone") as string;
  const displayName = formData.get("display_name") as string;

  const update: Record<string, string> = {};
  if (baseCurrency) update.base_currency = baseCurrency;
  if (timezone) update.timezone = timezone;
  if (displayName !== null) update.display_name = displayName;

  if (Object.keys(update).length === 0) {
    return { success: false, error: "没有需要更新的字段" };
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/converter");
  revalidatePath("/exchange");

  return { success: true };
}

/**
 * Export all user data as JSON.
 */
export async function exportDataAction(format: "json" | "csv" = "json") {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  // Fetch all user data
  const [accounts, categories, transactions, exchangeRates, exchanges, profile] = await Promise.all([
    supabase.from("accounts").select("*").eq("user_id", user.id).order("created_at"),
    supabase.from("categories").select("*").or(`user_id.is.null,user_id.eq.${user.id}`).order("created_at"),
    supabase.from("transactions").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false }),
    supabase.from("exchange_rates").select("*").eq("user_id", user.id).order("effective_at", { ascending: false }),
    supabase.from("exchanges").select("*").eq("user_id", user.id).order("transaction_date", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", user.id).single(),
  ]);

  const data = {
    exported_at: new Date().toISOString(),
    profile: profile.data,
    accounts: accounts.data ?? [],
    categories: categories.data ?? [],
    transactions: transactions.data ?? [],
    exchange_rates: exchangeRates.data ?? [],
    exchanges: exchanges.data ?? [],
  };

  if (format === "json") {
    const jsonStr = JSON.stringify(data, null, 2);
    return {
      success: true,
      content: jsonStr,
      filename: `money-book-export-${new Date().toISOString().slice(0, 10)}.json`,
      contentType: "application/json",
    };
  } else {
    // CSV format: transactions only
    const txns = transactions.data ?? [];
    const headers = [
      "date", "type", "account", "category", "amount", "currency",
      "base_currency", "exchange_rate", "base_amount", "note",
    ];
    const rows = txns.map((t) => {
      const account = accounts.data?.find((a) => a.id === t.account_id);
      const category = categories.data?.find((c) => c.id === t.category_id);
      return [
        t.transaction_date,
        t.transaction_type,
        account?.name ?? "",
        category?.name ?? "",
        t.amount,
        t.currency,
        t.base_currency,
        t.exchange_rate,
        t.base_amount,
        t.note ?? "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csvStr = [headers.join(","), ...rows].join("\n");

    return {
      success: true,
      content: csvStr,
      filename: `money-book-transactions-${new Date().toISOString().slice(0, 10)}.csv`,
      contentType: "text/csv",
    };
  }
}
