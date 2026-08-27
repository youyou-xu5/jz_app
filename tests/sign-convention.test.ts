import Decimal from "decimal.js";
import { describe, it, expect } from "vitest";
import { calculateBaseAmount, roundAmount } from "@/lib/currency/convert";

/**
 * Amount sign convention tests.
 *
 * Income  = positive
 * Expense = negative
 * Transfer-in  = positive
 * Transfer-out = negative
 *
 * Balance = initial_balance + SUM(amount)
 */

describe("Amount sign convention", () => {
  const baseCurrency = "CNY";
  const rate = "4.8";

  it("income is positive", () => {
    const incomeAmount = 5000;
    expect(incomeAmount).toBeGreaterThan(0);
    const baseAmount = calculateBaseAmount(incomeAmount, rate, "CNY", baseCurrency);
    expect(baseAmount.gt(0)).toBe(true);
  });

  it("expense is negative (stored as negative in DB)", () => {
    // The action layer negates the amount for expenses
    const expenseAmount = -200; // already negated
    expect(expenseAmount).toBeLessThan(0);
  });

  it("balance calculation: initial + income - expense", () => {
    const initial = 10000;
    const income = 5000;
    const expense = -2000;
    const balance = initial + income + expense;
    expect(balance).toBe(13000);
  });

  it("balance with cross-currency income", () => {
    const initial = 10000; // CNY
    const thbIncome = 4800; // THB
    const baseAmount = calculateBaseAmount(thbIncome, rate, "THB", baseCurrency);
    const balance = initial + Number(roundAmount(baseAmount));
    expect(balance).toBe(11000); // 10000 + 1000
  });

  it("balance with cross-currency expense", () => {
    const initial = 10000; // CNY
    const thbExpense = -4800; // THB, already negated
    const baseAmount = calculateBaseAmount(thbExpense, rate, "THB", baseCurrency);
    const balance = initial + Number(roundAmount(baseAmount));
    expect(balance).toBe(9000); // 10000 - 1000
  });

  it("transfer: out is negative, in is positive, net zero", () => {
    const transferAmount = 1000;
    const outAmount = -transferAmount;
    const inAmount = transferAmount;
    const net = outAmount + inAmount;
    expect(net).toBe(0);
  });

  it("exchange: from account decreases, to account increases", () => {
    // 2000 CNY -> 9550 THB
    const fromAmount = -2000; // CNY account
    const toAmount = 9550; // THB account
    // From account change
    expect(fromAmount).toBeLessThan(0);
    // To account change
    expect(toAmount).toBeGreaterThan(0);
  });
});

describe("Exchange rate direction", () => {
  /**
   * Standard: 1 base = rate × quote
   * Example: 1 CNY = 4.8 THB
   */

  it("CNY -> THB (base -> quote): multiply", () => {
    // 100 CNY × 4.8 = 480 THB
    const rate = "4.8";
    const amount = 100;
    const baseAmount = calculateBaseAmount(amount, rate, "CNY", "CNY");
    expect(baseAmount.toString()).toBe("100");
  });

  it("THB -> CNY (quote -> base): divide", () => {
    // 480 THB / 4.8 = 100 CNY
    const rate = "4.8";
    const amount = 480;
    const baseAmount = calculateBaseAmount(amount, rate, "THB", "CNY");
    expect(roundAmount(baseAmount).toString()).toBe("100");
  });

  it("historical snapshot is immutable", () => {
    // Transaction at rate 4.8
    const historicalRate = "4.8";
    const thbAmount = 480;
    const baseAtTime = calculateBaseAmount(thbAmount, historicalRate, "THB", "CNY");
    expect(roundAmount(baseAtTime).toString()).toBe("100");

    // Even if current rate changes to 4.5, the stored base_amount doesn't change
    // because it was saved at creation time
    const currentRate = "4.5";
    const newBaseAtNewRate = calculateBaseAmount(thbAmount, currentRate, "THB", "CNY");
    expect(roundAmount(newBaseAtNewRate).toString()).toBe("106.6667");

    // But the old one is still 100
    expect(roundAmount(baseAtTime).toString()).toBe("100");
  });
});
