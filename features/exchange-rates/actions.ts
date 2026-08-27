"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { exchangeRateSchema } from "@/lib/validation/schemas";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Save a new exchange rate. Always inserts a new record (append-only).
 * Never overwrites existing rate history.
 */
export async function saveExchangeRateAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const raw = {
    base_currency: formData.get("base_currency") as string,
    quote_currency: formData.get("quote_currency") as string,
    rate: formData.get("rate") as string,
  };

  const parse = exchangeRateSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  if (parse.data.base_currency === parse.data.quote_currency) {
    return { success: false, error: "基础币种和目标币种不能相同" };
  }

  const { error } = await supabase.from("exchange_rates").insert({
    user_id: user.id,
    base_currency: parse.data.base_currency,
    quote_currency: parse.data.quote_currency,
    rate: parse.data.rate,
    source: "manual",
    effective_at: new Date().toISOString(),
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/converter");
  revalidatePath("/dashboard");
  return { success: true };
}
