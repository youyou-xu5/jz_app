"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { calculateActualRate } from "@/lib/currency/convert";
import { getCurrentDate } from "@/lib/utils/date";

type ActionResult = { success: true } | { success: false; error: string };

export async function createExchangeAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const fromAccountId = formData.get("from_account_id") as string;
  const toAccountId = formData.get("to_account_id") as string;
  const fromCurrency = formData.get("from_currency") as string;
  const toCurrency = formData.get("to_currency") as string;
  const fromAmount = formData.get("from_amount") as string;
  const toAmount = formData.get("to_amount") as string;
  const referenceRate = (formData.get("reference_rate") as string) || null;
  const feeAmount = (formData.get("fee_amount") as string) || null;
  const feeCurrency = (formData.get("fee_currency") as string) || null;
  const transactionDate = (formData.get("transaction_date") as string) || getCurrentDate();
  const note = (formData.get("note") as string) || null;

  // Validate
  if (!fromAccountId || !toAccountId) return { success: false, error: "请选择账户" };
  if (!fromCurrency || !toCurrency) return { success: false, error: "缺少币种信息" };
  if (fromCurrency === toCurrency) return { success: false, error: "相同币种请使用转账功能" };
  if (!fromAmount || Number(fromAmount) <= 0) return { success: false, error: "支付金额必须大于 0" };
  if (!toAmount || Number(toAmount) <= 0) return { success: false, error: "收到金额必须大于 0" };
  if (fromAccountId === toAccountId) return { success: false, error: "转出和转入账户不能相同" };

  // Get base_currency
  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();
  const baseCurrency = profile?.base_currency ?? "CNY";

  // Calculate actual_rate
  const actualRate = calculateActualRate(
    fromAmount,
    toAmount,
    fromCurrency,
    toCurrency,
    baseCurrency
  );

  // Call RPC
  const { error } = await supabase.rpc("create_exchange", {
    p_from_account_id: fromAccountId,
    p_to_account_id: toAccountId,
    p_from_currency: fromCurrency,
    p_to_currency: toCurrency,
    p_from_amount: fromAmount,
    p_to_amount: toAmount,
    p_reference_rate: referenceRate,
    p_actual_rate: actualRate.toDecimalPlaces(8).toString(),
    p_fee_amount: feeAmount || null,
    p_fee_currency: feeCurrency || null,
    p_base_currency: baseCurrency,
    p_transaction_date: transactionDate,
    p_note: note,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/exchange");
  return { success: true };
}

export async function deleteExchangeAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const exchangeId = formData.get("exchange_id") as string;
  if (!exchangeId) return { success: false, error: "缺少 exchange_id" };

  const { error } = await supabase.rpc("delete_exchange", {
    p_exchange_id: exchangeId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  revalidatePath("/exchange");
  return { success: true };
}
