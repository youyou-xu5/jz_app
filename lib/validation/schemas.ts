import { z } from "zod";

export const accountSchema = z.object({
  name: z.string().min(1, "账户名称不能为空").max(50, "名称最多 50 个字符"),
  currency: z.string().length(3, "币种必须是 3 位代码"),
  account_type: z.enum(["cash", "bank", "ewallet", "other"]).optional(),
  initial_balance: z.string().refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && isFinite(num);
    },
    "初始余额必须是有效数字"
  ).optional().default("0"),
  sort_order: z.number().int().min(0).optional().default(0),
});

export type AccountFormValues = z.infer<typeof accountSchema>;

export const categorySchema = z.object({
  name: z.string().min(1, "分类名称不能为空").max(30, "名称最多 30 个字符"),
  type: z.enum(["expense", "income"]),
  icon: z.string().optional().nullable(),
  color: z.string().optional().nullable(),
  sort_order: z.number().int().min(0).optional().default(0),
});

export type CategoryFormValues = z.infer<typeof categorySchema>;

export const exchangeRateSchema = z.object({
  base_currency: z.string().length(3),
  quote_currency: z.string().length(3),
  rate: z.string().refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    "汇率必须大于 0"
  ),
  source: z.string().optional().default("manual"),
});

export type ExchangeRateFormValues = z.infer<typeof exchangeRateSchema>;
