import { z } from "zod";

export const transactionSchema = z.object({
  transaction_type: z.enum(["expense", "income"]),
  account_id: z.string().uuid("请选择账户"),
  category_id: z.string().uuid("请选择分类").optional().nullable(),
  amount: z.string().refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    "金额必须大于 0"
  ),
  currency: z.string().length(3),
  transaction_date: z.string().min(1, "请选择日期"),
  note: z.string().max(200, "备注最多 200 字").optional().nullable(),
});

export type TransactionFormValues = z.infer<typeof transactionSchema>;

export const transferSchema = z.object({
  from_account_id: z.string().uuid("请选择转出账户"),
  to_account_id: z.string().uuid("请选择转入账户"),
  amount: z.string().refine(
    (val) => {
      const num = Number(val);
      return !isNaN(num) && num > 0;
    },
    "金额必须大于 0"
  ),
  currency: z.string().length(3),
  transaction_date: z.string().min(1, "请选择日期"),
  note: z.string().max(200).optional().nullable(),
});

export type TransferFormValues = z.infer<typeof transferSchema>;
