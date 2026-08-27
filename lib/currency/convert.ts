import Decimal from "decimal.js";

/**
 * 汇率统一标准: 1 base_currency = rate × quote_currency
 *
 * Example: base = CNY, quote = THB, rate = 4.8
 *   1 CNY = 4.8 THB
 *
 * To convert:
 *   base → quote: amount_in_quote = base_amount × rate
 *   quote → base: base_amount = quote_amount ÷ rate
 *
 * When currency === base_currency, rate = 1, base_amount = amount.
 */

Decimal.set({
  precision: 20,
  rounding: Decimal.ROUND_HALF_UP,
});

export const AMOUNT_DP = 4; // numeric(18,4)
export const RATE_DP = 8; // numeric(18,8)
export const DISPLAY_AMOUNT_DP = 2;
export const DISPLAY_RATE_DP = 4;

/**
 * Convert an amount from one currency to another using the system's
 * standard rate direction (1 base = rate × quote).
 *
 * @param amount - The amount to convert (string or number for safety)
 * @param rate - The exchange rate (1 base = rate × quote)
 * @param fromCurrency - Source currency code
 * @param toCurrency - Target currency code
 * @param baseCurrency - The base currency (defines rate direction)
 */
export function convertAmount(
  amount: string | number,
  rate: string | number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string
): Decimal {
  const dAmount = new Decimal(amount);
  const dRate = new Decimal(rate);

  if (fromCurrency === toCurrency) {
    return dAmount;
  }

  if (dRate.lte(0)) {
    throw new Error(`Exchange rate must be > 0, got ${rate}`);
  }

  // quote → base: divide by rate
  // base → quote: multiply by rate
  if (fromCurrency === baseCurrency) {
    // base → quote
    return dAmount.times(dRate);
  } else {
    // quote → base
    return dAmount.dividedBy(dRate);
  }
}

/**
 * Calculate base_amount for a transaction.
 *
 * If transaction currency === base_currency:
 *   base_amount = amount, rate = 1
 *
 * If transaction currency !== base_currency:
 *   base_amount = amount ÷ rate (quote → base)
 *
 * The transaction stores the rate as it was at the time of the transaction
 * (a snapshot). Later rate changes must NOT affect this.
 */
export function calculateBaseAmount(
  amount: string | number,
  rate: string | number,
  currency: string,
  baseCurrency: string
): Decimal {
  const dAmount = new Decimal(amount);

  if (currency === baseCurrency) {
    return dAmount;
  }

  const dRate = new Decimal(rate);
  if (dRate.lte(0)) {
    throw new Error(`Exchange rate must be > 0, got ${rate}`);
  }

  // quote → base: divide
  return dAmount.dividedBy(dRate);
}

/**
 * Calculate the actual rate from a real exchange.
 *
 * actual_rate = to_amount / from_amount
 *
 * The rate direction is always: 1 base = rate × quote
 * So if from = CNY (base) and to = THB (quote):
 *   actual_rate = to_amount / from_amount (THB per CNY)
 *
 * If from = THB (quote) and to = CNY (base):
 *   actual_rate = from_amount / to_amount (THB per CNY)
 */
export function calculateActualRate(
  fromAmount: string | number,
  toAmount: string | number,
  fromCurrency: string,
  toCurrency: string,
  baseCurrency: string
): Decimal {
  const dFrom = new Decimal(fromAmount);
  const dTo = new Decimal(toAmount);

  if (dFrom.lte(0) || dTo.lte(0)) {
    throw new Error("Amounts must be > 0");
  }

  if (fromCurrency === toCurrency) {
    return new Decimal(1);
  }

  // We need: 1 base = rate × quote
  // If from = base, to = quote: rate = to / from
  // If from = quote, to = base: rate = from / to
  if (fromCurrency === baseCurrency) {
    return dTo.dividedBy(dFrom);
  } else {
    return dFrom.dividedBy(dTo);
  }
}

/**
 * Round a Decimal to the given number of decimal places.
 */
export function roundTo(value: Decimal, dp: number): Decimal {
  return value.toDecimalPlaces(dp, Decimal.ROUND_HALF_UP);
}

/**
 * Round an amount to database precision (4 dp).
 */
export function roundAmount(value: Decimal): Decimal {
  return roundTo(value, AMOUNT_DP);
}

/**
 * Round a rate to database precision (8 dp).
 */
export function roundRate(value: Decimal): Decimal {
  return roundTo(value, RATE_DP);
}
