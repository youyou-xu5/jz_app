import { createClient } from "@/lib/supabase/server";
import type { Category } from "@/types/database";

/**
 * Get all categories visible to the user: system categories + user's custom categories.
 * Separated by type (expense / income).
 */
export async function getCategories(): Promise<{
  expense: Category[];
  income: Category[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { expense: [], income: [] };

  // System categories (user_id IS NULL) + user's categories
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .eq("is_archived", false)
    .order("sort_order", { ascending: true });

  if (error || !data) return { expense: [], income: [] };

  return {
    expense: data.filter((c) => c.type === "expense"),
    income: data.filter((c) => c.type === "income"),
  };
}

/**
 * Get categories for a specific type (for transaction form selects).
 */
export async function getCategoriesByType(
  type: "expense" | "income"
): Promise<Category[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .or(`user_id.is.null,user_id.eq.${user.id}`)
    .eq("is_archived", false)
    .eq("type", type)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data;
}
