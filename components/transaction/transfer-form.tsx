"use client";

import * as React from "react";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { createTransferAction } from "@/features/transfer/actions";
import { getCurrentDate } from "@/lib/utils/date";
import { getCurrencySymbol } from "@/lib/currency/format";
import type { Account } from "@/types/database";

interface TransferFormProps {
  accounts: Account[];
  onClose: () => void;
}

export function TransferForm({ accounts, onClose }: TransferFormProps) {
  const { toast } = useToast();
  const [fromAccountId, setFromAccountId] = React.useState(accounts[0]?.id ?? "");
  const [toAccountId, setToAccountId] = React.useState(accounts[1]?.id ?? "");
  const [loading, setLoading] = React.useState(false);

  const fromAccount = accounts.find((a) => a.id === fromAccountId);
  const currency = fromAccount?.currency ?? "CNY";

  // Filter target accounts to same currency
  const toAccounts = accounts.filter((a) => a.currency === currency && a.id !== fromAccountId);

  React.useEffect(() => {
    // Reset to account if currency mismatch
    const toAccount = accounts.find((a) => a.id === toAccountId);
    if (!toAccount || toAccount.currency !== currency) {
      setToAccountId(toAccounts[0]?.id ?? "");
    }
  }, [currency]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    formData.set("currency", currency);
    const result = await createTransferAction(formData);
    setLoading(false);

    if (result.success) {
      toast({ title: "转账成功", variant: "success" });
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
      {/* From account */}
      <div className="space-y-2">
        <Label htmlFor="from_account_id">转出账户</Label>
        <Select
          id="from_account_id"
          name="from_account_id"
          value={fromAccountId}
          onChange={(e) => setFromAccountId(e.target.value)}
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
          placeholder="0.00"
          className="text-lg"
        />
      </div>

      {/* Arrow */}
      <div className="flex justify-center">
        <ArrowRight className="h-5 w-5 text-muted-foreground rotate-90" />
      </div>

      {/* To account */}
      <div className="space-y-2">
        <Label htmlFor="to_account_id">转入账户</Label>
        <Select
          id="to_account_id"
          name="to_account_id"
          value={toAccountId}
          onChange={(e) => setToAccountId(e.target.value)}
          required
        >
          {toAccounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      {toAccounts.length === 0 && (
        <p className="text-sm text-destructive">
          没有同币种的其他账户，请先创建一个
        </p>
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
        <Input id="note" name="note" type="text" placeholder="可选" />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" loading={loading} disabled={toAccounts.length === 0}>
          确认转账
        </Button>
      </div>
    </form>
  );
}
