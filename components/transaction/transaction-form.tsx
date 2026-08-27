"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createTransactionAction,
} from "@/features/transactions/actions";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency/format";
import { getCurrentDate } from "@/lib/utils/date";
import { calculateBaseAmount, roundAmount } from "@/lib/currency/convert";
import type { Account, Category } from "@/types/database";

interface TransactionFormProps {
  mode: "create" | "edit";
  accounts: Account[];
  expenseCategories: Category[];
  incomeCategories: Category[];
  baseCurrency: string;
  latestRate: string;
  onClose: () => void;
}

type TxType = "expense" | "income";

export function TransactionForm({
  mode,
  accounts,
  expenseCategories,
  incomeCategories,
  baseCurrency,
  latestRate,
  onClose,
}: TransactionFormProps) {
  const { toast } = useToast();
  const [txType, setTxType] = React.useState<TxType>("expense");
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [currency, setCurrency] = React.useState(accounts[0]?.currency ?? baseCurrency);
  const [rate, setRate] = React.useState(latestRate);
  const [showRate, setShowRate] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  // When account changes, update currency
  React.useEffect(() => {
    const account = accounts.find((a) => a.id === accountId);
    if (account) {
      setCurrency(account.currency);
      setShowRate(account.currency !== baseCurrency);
    }
  }, [accountId, accounts, baseCurrency]);

  const categories = txType === "expense" ? expenseCategories : incomeCategories;
  const baseAmountPreview = amount && rate
    ? calculateBaseAmount(amount, rate, currency, baseCurrency)
    : null;

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("transaction_type", txType);
    formData.set("currency", currency);
    if (currency !== baseCurrency) {
      formData.set("exchange_rate", rate);
    }
    const result = await createTransactionAction(formData);
    setLoading(false);

    if (result.success) {
      toast({
        title: txType === "expense" ? "支出已记录" : "收入已记录",
        variant: "success",
      });
      onClose();
    } else {
      toast({
        title: "操作失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  return (
    <form action={handleSubmit} className="space-y-4">
      {/* Type tabs */}
      <div className="flex rounded-md border p-1">
        <button
          type="button"
          onClick={() => setTxType("expense")}
          className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            txType === "expense"
              ? "bg-destructive text-destructive-foreground"
              : "text-muted-foreground"
          }`}
        >
          支出
        </button>
        <button
          type="button"
          onClick={() => setTxType("income")}
          className={`flex-1 rounded-sm px-3 py-1.5 text-sm font-medium transition-colors ${
            txType === "income"
              ? "bg-success text-success-foreground"
              : "text-muted-foreground"
          }`}
        >
          收入
        </button>
      </div>

      {/* Account */}
      <div className="space-y-2">
        <Label htmlFor="account_id">账户</Label>
        <Select
          id="account_id"
          name="account_id"
          value={accountId}
          onChange={(e) => setAccountId(e.target.value)}
          required
        >
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
      </div>

      {/* Amount */}
      <div className="space-y-2">
        <Label htmlFor="amount">
          金额 ({getCurrencySymbol(currency)} {currency})
        </Label>
        <Input
          id="amount"
          name="amount"
          type="number"
          step="0.0001"
          min="0"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0.00"
          className="text-lg"
        />
      </div>

      {/* Category */}
      <div className="space-y-2">
        <Label htmlFor="category_id">分类</Label>
        <Select id="category_id" name="category_id">
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Rate (if cross-currency) */}
      {showRate && (
        <div className="space-y-2">
          <Label htmlFor="exchange_rate">
            汇率 (1 {baseCurrency} = {rate} {currency})
          </Label>
          <Input
            id="exchange_rate"
            type="number"
            step="0.00000001"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="text-sm"
          />
          {baseAmountPreview && (
            <p className="text-xs text-muted-foreground">
              ≈ {formatCurrency(roundAmount(baseAmountPreview), baseCurrency)}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            此汇率仅用于当前交易，不会修改系统汇率
          </p>
        </div>
      )}

      {/* Date */}
      <div className="space-y-2">
        <Label htmlFor="transaction_date">日期</Label>
        <Input
          id="transaction_date"
          name="transaction_date"
          type="date"
          required
          defaultValue={getCurrentDate()}
        />
      </div>

      {/* Note */}
      <div className="space-y-2">
        <Label htmlFor="note">备注</Label>
        <Input
          id="note"
          name="note"
          type="text"
          placeholder="可选"
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" loading={loading}>
          {mode === "create" ? "记录" : "保存"}
        </Button>
      </div>
    </form>
  );
}
