import { createClient } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

export type ExchangeRate = Database["public"]["Tables"]["exchange_rates"]["Row"];

/**
 * Get the latest exchange rate for a currency pair.
 * The rate direction is always: 1 base_currency = rate × quote_currency
 *
 * Returns rate = 1 if base === quote.
 */
export async function getLatestRate(
  baseCurrency: string,
  quoteCurrency: string
): Promise<string> {
  if (baseCurrency === quoteCurrency) {
    return "1";
  }

  const supabase = createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("rate")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("effective_at", { ascending: false })
    .limit(1)
    .single();

  if (error || !data) {
    // Try reverse direction
    const { data: reverseData, error: reverseError } = await supabase
      .from("exchange_rates")
      .select("rate")
      .eq("base_currency", quoteCurrency)
      .eq("quote_currency", baseCurrency)
      .order("effective_at", { ascending: false })
      .limit(1)
      .single();

    if (reverseError || !reverseData) {
      throw new Error(
        `No exchange rate found for ${baseCurrency}/${quoteCurrency}`
      );
    }

    // Reverse: stored as 1 quote = rate × base
    // Need: 1 base = (1/rate) × quote
    const reversedRate = Number(reverseData.rate);
    return (1 / reversedRate).toFixed(8);
  }

  return data.rate;
}

/**
 * Get exchange rate history for a currency pair.
 */
export async function getRateHistory(
  baseCurrency: string,
  quoteCurrency: string
): Promise<ExchangeRate[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("exchange_rates")
    .select("*")
    .eq("base_currency", baseCurrency)
    .eq("quote_currency", quoteCurrency)
    .order("effective_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

/**
 * Save a new exchange rate. Never overwrites existing records.
 */
export async function saveExchangeRate(params: {
  baseCurrency: string;
  quoteCurrency: string;
  rate: string;
  source?: string;
}): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase.from("exchange_rates").insert({
    user_id: user.id,
    base_currency: params.baseCurrency,
    quote_currency: params.quoteCurrency,
    rate: params.rate,
    source: params.source ?? "manual",
    effective_at: new Date().toISOString(),
  });

  if (error) throw error;
}
