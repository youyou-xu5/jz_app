"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import Decimal from "decimal.js";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createExchangeAction } from "@/features/exchange/actions";
import { calculateActualRate, roundRate } from "@/lib/currency/convert";
import { formatCurrency, getCurrencySymbol } from "@/lib/currency/format";
import { getCurrentDate } from "@/lib/utils/date";
import type { Account } from "@/types/database";

interface ExchangeFormProps {
  accounts: Account[];
  baseCurrency: string;
  latestRate: string;
  onClose: () => void;
}

export function ExchangeForm({
  accounts,
  baseCurrency,
  latestRate,
  onClose,
}: ExchangeFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);
  const [fromAccountId, setFromAccountId] = React.useState("");
  const [toAccountId, setToAccountId] = React.useState("");
  const [fromAmount, setFromAmount] = React.useState("");
  const [toAmount, setToAmount] = React.useState("");
  const [lastEdited, setLastEdited] = React.useState<"from" | "to">("from");

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const toAccount = accounts.find((a) => a.id === toAccountId);
  const fromCurrency = fromAccount?.currency ?? baseCurrency;
  const toCurrency = toAccount?.currency ?? (baseCurrency === "CNY" ? "THB" : "CNY");

  // Filter accounts by currency
  const fromAccounts = accounts;
  const toAccounts = accounts.filter((a) => a.currency !== fromCurrency);

  React.useEffect(() => {
    // Auto-select first accounts
    if (!fromAccountId && accounts.length > 0) {
      const firstBase = accounts.find((a) => a.currency === baseCurrency) ?? accounts[0];
      setFromAccountId(firstBase.id);
    }
    if (!toAccountId) {
      const firstQuote = accounts.find((a) => a.currency !== (fromAccount?.currency ?? baseCurrency));
      if (firstQuote) setToAccountId(firstQuote.id);
    }
  }, [accounts]); // eslint-disable-line react-hooks/exhaustive-deps

  // Calculate actual rate
  const actualRate = fromAmount && toAmount
    ? calculateActualRate(fromAmount, toAmount, fromCurrency, toCurrency, baseCurrency)
    : null;

  // Expected to_amount based on reference rate
  const expectedTo = fromAmount && latestRate
    ? new Decimal(fromAmount).times(new Decimal(latestRate))
    : null;

  // Rate difference percentage
  const rateDiff = actualRate && latestRate
    ? actualRate.minus(new Decimal(latestRate)).dividedBy(new Decimal(latestRate)).times(100)
    : null;

  function handleFromAmountChange(val: string) {
    setFromAmount(val);
    setLastEdited("from");
    if (val && Number(val) > 0 && latestRate) {
      const expected = new Decimal(val).times(new Decimal(latestRate));
      setToAmount(expected.toDecimalPlaces(4).toString());
    } else {
      setToAmount("");
    }
  }

  function handleToAmountChange(val: string) {
    setToAmount(val);
    setLastEdited("to");
    // User manually overrides to_amount, don't auto-recompute from
  }

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("from_currency", fromCurrency);
    formData.set("to_currency", toCurrency);
    formData.set("reference_rate", latestRate);
    const result = await createExchangeAction(formData);
    setLoading(false);

    if (result.success) {
      toast({ title: "换汇成功", variant: "success" });
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
      {/* From account + amount */}
      <div className="space-y-2">
        <Label htmlFor="from_account_id">从账户</Label>
        <Select
          id="from_account_id"
          name="from_account_id"
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
          required
        >
          {fromAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="from_amount">
          支付金额 ({getCurrencySymbol(fromCurrency)} {fromCurrency})
        </Label>
        <Input
          id="from_amount"
          name="from_amount"
          type="number"
          step="0.0001"
          min="0"
          required
          value={fromAmount}
          onChange={(e) => handleFromAmountChange(e.target.value)}
          placeholder="0.00"
          className="text-lg"
        />
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
      </div>

      {/* To account + amount */}
      <div className="space-y-2">
        <Label htmlFor="to_account_id">到账户</Label>
        <Select
          id="to_account_id"
          name="to_account_id"
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
          required
        >
          {toAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.currency})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="to_amount">
          实际收到 ({getCurrencySymbol(toCurrency)} {toCurrency})
        </Label>
        <Input
          id="to_amount"
          name="to_amount"
          type="number"
          step="0.0001"
          min="0"
          required
          value={toAmount}
          onChange={(e) => handleToAmountChange(e.target.value)}
          placeholder="0.00"
          className="text-lg"
        />
      </div>

      {/* Rate info */}
      <div className="rounded-md bg-muted/50 p-3 space-y-1 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">参考汇率</span>
          <span>1 {baseCurrency} = {latestRate} {baseCurrency === "CNY" ? "THB" : "CNY"}</span>
        </div>
        {expectedTo && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">预计到账</span>
            <span>{formatCurrency(expectedTo, toCurrency)}</span>
          </div>
        )}
        {actualRate && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">实际汇率</span>
            <span>1 {baseCurrency} = {roundRate(actualRate).toDecimalPlaces(4).toString()} {toCurrency}</span>
          </div>
        )}
        {rateDiff && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">汇率差</span>
            <span className={rateDiff.lt(0) ? "text-destructive" : "text-success"}>
              {rateDiff.toDecimalPlaces(2).toString()}%
            </span>
          </div>
        )}
      </div>

      {/* Fee */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="fee_amount">手续费 (可选)</Label>
          <Input
            id="fee_amount"
            name="fee_amount"
            type="number"
            step="0.0001"
            placeholder="0.00"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="fee_currency">手续费币种</Label>
          <Select id="fee_currency" name="fee_currency">
            <option value="">选择</option>
            <option value={fromCurrency}>{fromCurrency}</option>
            <option value={toCurrency}>{toCurrency}</option>
          </Select>
        </div>
      </div>

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
        <Input id="note" name="note" type="text" placeholder="例如: SuperRich 换汇" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" loading={loading}>
          确认换汇
        </Button>
      </div>
    </form>
  );
}
