"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { transferSchema } from "@/features/transactions/schemas";

type ActionResult = { success: true } | { success: false; error: string };

/**
 * Create a same-currency transfer via RPC.
 * The RPC atomically creates two transactions with shared transfer_group_id.
 */
export async function createTransferAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const raw = {
    from_account_id: formData.get("from_account_id") as string,
    to_account_id: formData.get("to_account_id") as string,
    amount: formData.get("amount") as string,
    currency: formData.get("currency") as string,
    transaction_date: formData.get("transaction_date") as string,
    note: (formData.get("note") as string) || null,
  };

  const parse = transferSchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  if (parse.data.from_account_id === parse.data.to_account_id) {
    return { success: false, error: "转出和转入账户不能相同" };
  }

  // Call the RPC
  const { error } = await supabase.rpc("create_transfer", {
    p_from_account_id: parse.data.from_account_id,
    p_to_account_id: parse.data.to_account_id,
    p_amount: parse.data.amount,
    p_currency: parse.data.currency,
    p_transaction_date: parse.data.transaction_date,
    p_note: parse.data.note,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}

/**
 * Delete a transfer via RPC.
 * Atomically deletes both transactions in the transfer group.
 */
export async function deleteTransferAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const groupId = formData.get("transfer_group_id") as string;
  if (!groupId) return { success: false, error: "缺少 transfer_group_id" };

  const { error } = await supabase.rpc("delete_transfer", {
    p_group_id: groupId,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/transactions");
  revalidatePath("/dashboard");
  revalidatePath("/accounts");
  return { success: true };
}
