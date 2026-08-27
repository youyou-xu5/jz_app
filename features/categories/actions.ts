"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categorySchema } from "@/lib/validation/schemas";

type ActionResult = { success: true } | { success: false; error: string };

export async function createCategoryAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const raw = {
    name: formData.get("name") as string,
    type: formData.get("type") as "expense" | "income",
    icon: (formData.get("icon") as string) || null,
    color: (formData.get("color") as string) || null,
    sort_order: 0,
  };

  const parse = categorySchema.safeParse(raw);
  if (!parse.success) {
    return { success: false, error: parse.error.errors[0].message };
  }

  const { error } = await supabase.from("categories").insert({
    user_id: user.id,
    name: parse.data.name,
    type: parse.data.type,
    icon: parse.data.icon,
    color: parse.data.color,
    sort_order: parse.data.sort_order,
    is_system: false,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { success: true };
}

export async function archiveCategoryAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;

  // Check if category has transactions
  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    // Archive: set is_archived = true
    const { error } = await supabase
      .from("categories")
      .update({ is_archived: true })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
  } else {
    // No transactions: safe to delete (only user categories)
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) return { success: false, error: error.message };
  }

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { success: true };
}

export async function deleteCategoryAction(formData: FormData): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false, error: "未登录" };

  const id = formData.get("id") as string;

  const { count } = await supabase
    .from("transactions")
    .select("*", { count: "exact", head: true })
    .eq("category_id", id);

  if (count && count > 0) {
    return {
      success: false,
      error: "该分类有交易记录，无法删除。请改用归档功能。",
    };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/transactions");
  return { success: true };
}
