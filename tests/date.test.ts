import { describe, it, expect } from "vitest";
import {
  getCurrentDate,
  formatDate,
  formatDateTime,
  getMonthRange,
  getCurrentYearMonth,
  generateUUID,
} from "@/lib/utils/date";

describe("getCurrentDate", () => {
  it("returns a date string in YYYY-MM-DD format", () => {
    const date = getCurrentDate("Asia/Bangkok");
    expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("works with different timezones", () => {
    const bangkok = getCurrentDate("Asia/Bangkok");
    const shanghai = getCurrentDate("Asia/Shanghai");
    // Both should be valid dates
    expect(bangkok).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(shanghai).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("formatDate", () => {
  it("formats a date string", () => {
    const result = formatDate("2024-08-15");
    expect(result).toBe("8月15日");
  });

  it("formats with custom pattern", () => {
    const result = formatDate("2024-08-15", "yyyy-MM-dd");
    expect(result).toBe("2024-08-15");
  });

  it("returns input on invalid date", () => {
    const result = formatDate("invalid");
    expect(result).toBe("invalid");
  });
});

describe("formatDateTime", () => {
  it("formats a datetime string", () => {
    const result = formatDateTime("2024-08-15T14:30:00");
    expect(result).toContain("2024-08-15");
    expect(result).toContain("14:30");
  });
});

describe("getMonthRange", () => {
  it("returns correct range for January", () => {
    const { start, end } = getMonthRange(2024, 1);
    expect(start).toBe("2024-01-01");
    expect(end).toBe("2024-01-31");
  });

  it("returns correct range for February (non-leap year)", () => {
    const { start, end } = getMonthRange(2023, 2);
    expect(start).toBe("2023-02-01");
    expect(end).toBe("2023-02-28");
  });

  it("returns correct range for February (leap year)", () => {
    const { start, end } = getMonthRange(2024, 2);
    expect(start).toBe("2024-02-01");
    expect(end).toBe("2024-02-29");
  });

  it("returns correct range for December", () => {
    const { start, end } = getMonthRange(2024, 12);
    expect(start).toBe("2024-12-01");
    expect(end).toBe("2024-12-31");
  });
});

describe("getCurrentYearMonth", () => {
  it("returns year and month as numbers", () => {
    const { year, month } = getCurrentYearMonth("Asia/Bangkok");
    expect(typeof year).toBe("number");
    expect(typeof month).toBe("number");
    expect(month).toBeGreaterThanOrEqual(1);
    expect(month).toBeLessThanOrEqual(12);
  });
});

describe("generateUUID", () => {
  it("returns a string", () => {
    const uuid = generateUUID();
    expect(typeof uuid).toBe("string");
  });

  it("returns a valid UUID format", () => {
    const uuid = generateUUID();
    expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it("generates unique UUIDs", () => {
    const uuid1 = generateUUID();
    const uuid2 = generateUUID();
    expect(uuid1).not.toBe(uuid2);
  });
});
