"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transactionSchema } from "./schemas";
import {
  calculateBaseAmount,
  roundAmount,
  roundRate,
} from "@/lib/currency/convert";
import { getCurrentDate } from "@/lib/utils/date";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Create an expense or income transaction.
 *
 * Amount sign convention:
 *   income  → positive
 *   expense → negative
 *
 * Exchange rate snapshot:
 *   - If currency === base_currency: rate = 1, base_amount = amount
 *   - If currency !== base_currency: rate = current latest rate (user can override), base_amount = amount / rate
 */
export async function createTransactionAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const raw = {
    transaction_type: formData.get("transaction_type") as "expense" | "income",
    account_id: formData.get("account_id") as string,
    category_id: (formData.get("category_id") as string) || null,
    amount: formData.get("amount") as string,
    currency: formData.get("currency") as string,
    transaction_date: formData.get("transaction_date") as string,
    note: (formData.get("note") as string) || null,
  };

  const parse = transactionSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  // Get profile base_currency
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "CNY";

  // Get rate (from form if provided, or fetch latest)
  let exchangeRate = "1";
  const formRate = formData.get("exchange_rate") as string | null;

  if (parse.data.currency !== baseCurrency) {
    if (formRate && Number(formRate) > 0) {
      exchangeRate = formRate;
    } else {
      // Fetch latest rate
      const quoteCurrency = parse.data.currency;
      const { data: rateData } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", baseCurrency)
        .eq("quote_currency", quoteCurrency)
        .order("effective_at", { ascending: false })
        .limit(1)
        .single();

      if (rateData) {
        exchangeRate = rateData.rate;
      } else {
        return {
          success: false,
          error: `未找到 ${baseCurrency}/${parse.data.currency} 的汇率，请先在设置中添加汇率`,
        };
      }
    }
  }

  // Calculate amounts with sign
  // income: positive, expense: negative
  const absAmount = parse.data.amount;
  const signedAmount =
    parse.data.transaction_type === "expense"
      ? `-${absAmount}`
      : absAmount;

  const baseAmount = calculateBaseAmount(
    absAmount,
    exchangeRate,
    parse.data.currency,
    baseCurrency
  );

  const signedBaseAmount =
    parse.data.transaction_type === "expense"
      ? baseAmount.negated()
      : baseAmount;

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    account_id: parse.data.account_id,
    transaction_type: parse.data.transaction_type,
    category_id: parse.data.category_id ?? null,
    amount: roundAmount(new (await import("decimal.js")).default(signedAmount)).toString(),
    currency: parse.data.currency,
    base_currency: baseCurrency,
    exchange_rate: roundRate(new (await import("decimal.js")).default(exchangeRate)).toString(),
    base_amount: roundAmount(signedBaseAmount).toString(),
    transaction_date: parse.data.transaction_date,
    note: parse.data.note,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}

export async function updateTransactionAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;
  const raw = {
    transaction_type: formData.get("transaction_type") as "expense" | "income",
    account_id: formData.get("account_id") as string,
    category_id: (formData.get("category_id") as string) || null,
    amount: formData.get("amount") as string,
    currency: formData.get("currency") as string,
    transaction_date: formData.get("transaction_date") as string,
    note: (formData.get("note") as string) || null,
  };

  const parse = transactionSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "CNY";

  let exchangeRate = "1";
  const formRate = formData.get("exchange_rate") as string | null;

  if (parse.data.currency !== baseCurrency) {
    if (formRate && Number(formRate) > 0) {
      exchangeRate = formRate;
    } else {
      const { data: rateData } = await supabase
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", baseCurrency)
        .eq("quote_currency", parse.data.currency)
        .order("effective_at", { ascending: false })
        .limit(1)
        .single();

      if (rateData) {
        exchangeRate = rateData.rate;
      }
    }
  }

  const Decimal = (await import("decimal.js")).default;
  const absAmount = new Decimal(parse.data.amount);
  const signedAmount =
    parse.data.transaction_type === "expense" ? absAmount.negated() : absAmount;

  const baseAbsAmount = calculateBaseAmount(
    parse.data.amount,
    exchangeRate,
    parse.data.currency,
    baseCurrency
  );
  const signedBaseAmount =
    parse.data.transaction_type === "expense"
      ? baseAbsAmount.negated()
      : baseAbsAmount;

  const { error } = await supabase
    .from("transactions")
    .update({
      account_id: parse.data.account_id,
      transaction_type: parse.data.transaction_type,
      category_id: parse.data.category_id ?? null,
      amount: roundAmount(signedAmount).toString(),
      currency: parse.data.currency,
      base_currency: baseCurrency,
      exchange_rate: roundRate(new Decimal(exchangeRate)).toString(),
      base_amount: roundAmount(signedBaseAmount).toString(),
      transaction_date: parse.data.transaction_date,
      note: parse.data.note,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}

export async function deleteTransactionAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;

  // Check if this is a transfer or exchange transaction
  const { data: txn } = await supabase
    .from("transactions")
    .select("transaction_type, transfer_group_id, exchange_id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!txn) return { success: false, error: "交易记录不存在" };

  if (txn.transaction_type === "transfer" && txn.transfer_group_id) {
    return {
      success: false,
      error: "请通过转账管理删除，不能单独删除转账的一边",
    };
  }

  if (txn.transaction_type === "exchange" && txn.exchange_id) {
    return {
      success: false,
      error: "请通过换汇管理删除，不能单独删除换汇的一边",
    };
  }

  const { error } = await supabase
    .from("transactions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}
