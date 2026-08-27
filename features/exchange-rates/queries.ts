import { createClient } from "@/lib/supabase/server";
import type { ExchangeRate } from "@/types/database";

/**
 * Get the latest exchange rate for a currency pair.
 * Rate direction: 1 base = rate × quote
 */
export async function getLatestRate(
  baseCurrency: string,
  quoteCurrency: string
): Promise<ExchangeRate | null> {
  if (baseCurrency === quoteCurrency) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // Try reverse direction
    const { data: reverseData } = await supabase
      .from("exchange_rates")
      .select("*")
      .eq("base_currency", quoteCurrency)
      .eq("quote_currency", baseCurrency)
      .order("effective_at", { ascending: false })
      .limit(1)
      .single();

    if (reverseData) {
      // Stored as 1 quote = rate × base, need 1 base = (1/rate) × quote
      const reversedRate = (1 / Number(reverseData.rate)).toFixed(8);
      return {
        ...reverseData,
        base_currency: baseCurrency,
        quote_currency: quoteCurrency,
        rate: reversedRate,
      };
    }
    return null;
  }

  return data;
}

/**
 * Get exchange rate history for a currency pair.
 */
export async function getRateHistory(
  baseCurrency: string,
  quoteCurrency: string
): Promise<ExchangeRate[]> {
  if (baseCurrency === quoteCurrency) return [];

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("effective_at", { ascending: false })
    .limit(50);

  if (error || !data) return [];
  return data;
}

/**
 * Get user's base currency from profile.
 */
export async function getBaseCurrency(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "CNY";

  const { data: profile } = await supabase
    .from("profiles")
    .select("base_currency")
    .eq("id", user.id)
    .single();

  return profile?.base_currency ?? "CNY";
}
