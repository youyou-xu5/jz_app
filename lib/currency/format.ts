import Decimal from "decimal.js";

const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: "\u00A5", // ¥
  THB: "\u0E3F", // ฿
  USD: "$",
  EUR: "\u20AC", // €
  JPY: "\u00A5", // ¥ (same symbol, different currency)
  GBP: "\u00A3", // £
};

const CURRENCY_LOCALES: Record<string, string> = {
  CNY: "zh-CN",
  THB: "th-TH",
  USD: "en-US",
  EUR: "de-DE",
  JPY: "ja-JP",
  GBP: "en-GB",
};

/**
 * Format a numeric amount as a currency string.
 *
 * CNY → ¥1,234.56
 * THB → ฿1,234.56
 *
 * Always use this function. Never do "¥" + amount in components.
 */
export function formatCurrency(
  amount: string | number | Decimal,
  currency: string,
  options?: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    showSign?: boolean;
  }
): string {
  const value =
    amount instanceof Decimal ? amount.toNumber() : Number(amount);

  const symbol = CURRENCY_SYMBOLS[currency] ?? "";
  const locale = CURRENCY_LOCALES[currency] ?? "en-US";

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(Math.abs(value));

  const sign = value < 0 ? "-" : options?.showSign && value > 0 ? "+" : "";

  return `${sign}${symbol}${formatted}`;
}

/**
 * Format a rate value to 4 decimal places.
 */
export function formatRate(
  rate: string | number | Decimal,
  options?: { dp?: number }
): string {
  const dp = options?.dp ?? 4;
  const value = rate instanceof Decimal ? rate : new Decimal(rate);
  return value.toDecimalPlaces(dp).toString();
}

/**
 * Format a plain number with thousands separators.
 */
export function formatNumber(
  amount: string | number | Decimal,
  options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }
): string {
  const value =
    amount instanceof Decimal ? amount.toNumber() : Number(amount);
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: options?.minimumFractionDigits ?? 0,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }).format(value);
}

/**
 * Get currency symbol.
 */
export function getCurrencySymbol(currency: string): string {
  return CURRENCY_SYMBOLS[currency] ?? "";
}
