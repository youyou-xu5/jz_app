"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { accountSchema } from "./schemas";
import type { Database } from "@/types/database";

type ActionResult = { success: true } | { success: false; error: string };

export async function createAccountAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const raw = {
    name: formData.get("name") as string,
    currency: formData.get("currency") as string,
    account_type: (formData.get("account_type") as string) || undefined,
    initial_balance: (formData.get("initial_balance") as string) || "0",
    sort_order: 0,
  };

  const parse = accountSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  const { error } = await supabase.from("accounts").insert({
    user_id: user.id,
    name: parse.data.name,
    currency: parse.data.currency,
    account_type: parse.data.account_type ?? null,
    initial_balance: parse.data.initial_balance,
    sort_order: parse.data.sort_order,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateAccountAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;
  const raw = {
    name: formData.get("name") as string,
    currency: formData.get("currency") as string,
    account_type: (formData.get("account_type") as string) || undefined,
    initial_balance: (formData.get("initial_balance") as string) || "0",
    sort_order: 0,
  };

  const parse = accountSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  const { error } = await supabase
    .from("accounts")
    .update({
      name: parse.data.name,
      currency: parse.data.currency,
      account_type: parse.data.account_type ?? null,
      initial_balance: parse.data.initial_balance,
    })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function archiveAccountAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;

  // Check if account has transactions
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  if (count && count > 0) {
    // Archive instead of delete
    const { error } = await supabase
      .from("accounts")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
  } else {
    // No transactions: safe to delete
    const { error } = await supabase
      .from("accounts")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}

export async function deleteAccountAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;

  // Check if account has transactions
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("account_id", id);

  if (count && count > 0) {
    return {
      success: false,
      error: "该账户有交易记录，无法删除。请改用归档功能。",
    };
  }

  const { error } = await supabase
    .from("accounts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return { success: true };
}
