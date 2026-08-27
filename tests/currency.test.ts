import Decimal from "decimal.js";
import { describe, it, expect } from "vitest";
import {
  convertAmount,
  calculateBaseAmount,
  calculateActualRate,
  roundAmount,
  roundRate,
} from "@/lib/currency/convert";

describe("Currency conversion", () => {
  const baseCurrency = "CNY";
  const quoteCurrency = "THB";

  describe("CNY -> THB (base -> quote)", () => {
    it("100 CNY at rate 4.8 = 480 THB", () => {
      const result = convertAmount(
        100, 4.8, baseCurrency, quoteCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("480");
    });

    it("2000 CNY at rate 4.8 = 9600 THB", () => {
      const result = convertAmount(
        2000, 4.8, baseCurrency, quoteCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("9600");
    });

    it("100 CNY at rate 4.5 = 450 THB (after rate change)", () => {
      const result = convertAmount(
        100, 4.5, baseCurrency, quoteCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("450");
    });
  });

  describe("THB -> CNY (quote -> base)", () => {
    it("480 THB at rate 4.8 = 100 CNY", () => {
      const result = convertAmount(
        480, 4.8, quoteCurrency, baseCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("100");
    });

    it("350 THB at rate 4.8 = 72.9167 CNY", () => {
      const result = convertAmount(
        350, 4.8, quoteCurrency, baseCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("72.9167");
    });

    it("9550 THB at rate 4.5 = 2122.2222 CNY", () => {
      const result = convertAmount(
        9550, 4.5, quoteCurrency, baseCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("2122.2222");
    });
  });

  describe("Same currency", () => {
    it("same currency returns amount unchanged", () => {
      const result = convertAmount(
        30000, 1, baseCurrency, baseCurrency, baseCurrency
      );
      expect(result.toString()).toBe("30000");
    });
  });

  describe("Decimal precision", () => {
    it("handles very small amounts", () => {
      const result = convertAmount(
        0.01, 4.8, quoteCurrency, baseCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("0.0021");
    });

    it("handles large amounts", () => {
      const result = convertAmount(
        1000000, 4.8, baseCurrency, quoteCurrency, baseCurrency
      );
      expect(roundAmount(result).toString()).toBe("4800000");
    });
  });
});

describe("calculateBaseAmount (for transactions)", () => {
  it("THB transaction with rate snapshot 4.8", () => {
    const result = calculateBaseAmount(480, 4.8, "THB", "CNY");
    expect(roundAmount(result).toString()).toBe("100");
  });

  it("CNY transaction (same as base) = amount", () => {
    const result = calculateBaseAmount(30000, 1, "CNY", "CNY");
    expect(result.toString()).toBe("30000");
  });

  it("THB 350 at rate 4.8 = 72.9167", () => {
    const result = calculateBaseAmount(350, 4.8, "THB", "CNY");
    expect(roundAmount(result).toString()).toBe("72.9167");
  });

  it("historical rate snapshot does not change when current rate changes", () => {
    // Transaction recorded at rate 4.8
    const historicalBase = calculateBaseAmount(480, 4.8, "THB", "CNY");
    expect(roundAmount(historicalBase).toString()).toBe("100");

    // Current rate changes to 4.5 - but historical snapshot stays the same
    const snapshotBase = calculateBaseAmount(480, 4.8, "THB", "CNY");
    expect(roundAmount(snapshotBase).toString()).toBe("100");

    // New transaction at new rate
    const newBase = calculateBaseAmount(480, 4.5, "THB", "CNY");
    expect(roundAmount(newBase).toString()).toBe("106.6667");
  });
});

describe("calculateActualRate (for exchanges)", () => {
  it("2000 CNY -> 9550 THB: actual rate = 4.775", () => {
    const result = calculateActualRate(
      2000, 9550, "CNY", "THB", "CNY"
    );
    expect(roundRate(result).toString()).toBe("4.775");
  });

  it("same currency = 1", () => {
    const result = calculateActualRate(
      1000, 1000, "CNY", "CNY", "CNY"
    );
    expect(result.toString()).toBe("1");
  });

  it("reverse: 9550 THB -> 2000 CNY: actual rate = 4.775", () => {
    const result = calculateActualRate(
      9550, 2000, "THB", "CNY", "CNY"
    );
    expect(roundRate(result).toString()).toBe("4.775");
  });
});

describe("formatCurrency integration", () => {
  it("formats converted amount correctly", async () => {
    const { formatCurrency } = await import("@/lib/currency/format");
    const result = formatCurrency(480, "THB");
    expect(result).toContain("480.00");
  });
});
