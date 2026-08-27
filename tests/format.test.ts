import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatRate,
  formatNumber,
  getCurrencySymbol,
} from "@/lib/currency/format";

describe("formatCurrency", () => {
  it("formats CNY with yen symbol", () => {
    const result = formatCurrency(1234.56, "CNY");
    expect(result).toContain("1,234.56");
  });

  it("formats THB with baht symbol", () => {
    const result = formatCurrency(1000, "THB");
    expect(result).toContain("1,000.00");
  });

  it("shows positive sign when showSign=true", () => {
    const result = formatCurrency(500, "CNY", { showSign: true });
    expect(result.startsWith("+")).toBe(true);
  });

  it("shows negative sign for negative amounts", () => {
    const result = formatCurrency(-100, "CNY");
    expect(result.startsWith("-")).toBe(true);
  });

  it("handles string input", () => {
    const result = formatCurrency("1234.56", "CNY");
    expect(result).toContain("1,234.56");
  });

  it("handles Decimal input", () => {
    const Decimal = require("decimal.js");
    const result = formatCurrency(new Decimal(99.99), "CNY");
    expect(result).toContain("99.99");
  });

  it("supports custom fraction digits", () => {
    const result = formatCurrency(100.5, "CNY", {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    });
    expect(result).toContain("100.5000");
  });

  it("handles zero", () => {
    const result = formatCurrency(0, "CNY");
    expect(result).toContain("0.00");
  });

  it("handles large amounts with grouping", () => {
    const result = formatCurrency(1234567.89, "CNY");
    expect(result).toContain("1,234,567.89");
  });
});

describe("formatRate", () => {
  it("formats rate to 4 decimal places by default", () => {
    expect(formatRate(4.8)).toBe("4.8");
  });

  it("formats rate to 8 decimal places", () => {
    expect(formatRate(4.8, { dp: 8 })).toBe("4.8");
  });

  it("handles string input", () => {
    expect(formatRate("4.775")).toBe("4.775");
  });

  it("handles very small rates", () => {
    expect(formatRate(0.00001)).toBe("0");
  });

  it("handles very large rates", () => {
    expect(formatRate(99999.99999)).toBe("100000");
  });
});

describe("formatNumber", () => {
  it("formats with grouping", () => {
    expect(formatNumber(1234567)).toBe("1,234,567");
  });

  it("formats with decimal places", () => {
    expect(formatNumber(1234.5678)).toBe("1,234.57");
  });

  it("formats with custom fraction digits", () => {
    expect(formatNumber(100.5, { minimumFractionDigits: 4, maximumFractionDigits: 4 })).toBe("100.5000");
  });
});

describe("getCurrencySymbol", () => {
  it("returns correct symbol for CNY", () => {
    expect(getCurrencySymbol("CNY")).toBe("\u00A5");
  });

  it("returns correct symbol for THB", () => {
    expect(getCurrencySymbol("THB")).toBe("\u0E3F");
  });

  it("returns correct symbol for USD", () => {
    expect(getCurrencySymbol("USD")).toBe("$");
  });

  it("returns correct symbol for EUR", () => {
    expect(getCurrencySymbol("EUR")).toBe("\u20AC");
  });

  it("returns empty string for unknown currency", () => {
    expect(getCurrencySymbol("XYZ")).toBe("");
  });
});
