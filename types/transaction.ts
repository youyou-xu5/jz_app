export type TransactionType = "expense" | "income" | "transfer" | "exchange";

export type AccountType = "cash" | "bank" | "ewallet" | "other";

export type CurrencyCode = "CNY" | "THB" | "USD" | "EUR" | "JPY" | "GBP";

export type CategoryType = "expense" | "income";

export type RateSource = "manual" | "api";

export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
}

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "CNY", symbol: "\u00A5", name: "人民币" },
  { code: "THB", symbol: "\u0E3F", name: "泰铢" },
  { code: "USD", symbol: "$", name: "美元" },
  { code: "EUR", symbol: "\u20AC", name: "欧元" },
  { code: "JPY", symbol: "\u00A5", name: "日元" },
  { code: "GBP", symbol: "\u00A3", name: "英镑" },
];

export const DEFAULT_EXPENSE_CATEGORIES = [
  "餐饮",
  "交通",
  "购物",
  "住房",
  "水电",
  "娱乐",
  "医疗",
  "学习",
  "旅行",
  "宝宝",
  "人情",
  "其他",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "工资",
  "奖金",
  "退款",
  "兼职",
  "投资收益",
  "其他收入",
];

export const ACCOUNT_TYPES: { value: AccountType; label: string }[] = [
  { value: "cash", label: "现金" },
  { value: "bank", label: "银行卡" },
  { value: "ewallet", label: "电子钱包" },
  { value: "other", label: "其他" },
];
