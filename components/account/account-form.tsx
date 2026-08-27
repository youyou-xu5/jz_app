"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  createAccountAction,
  updateAccountAction,
} from "@/features/accounts/actions";
import { SUPPORTED_CURRENCIES, ACCOUNT_TYPES } from "@/types/transaction";
import type { Account } from "@/types/database";

interface AccountFormProps {
  mode: "create" | "edit";
  account?: Account;
  onClose: () => void;
}

export function AccountForm({ mode, account, onClose }: AccountFormProps) {
  const { toast } = useToast();
  const [loading, setLoading] = React.useState(false);

  async function handleSubmit(formData: FormData) {
    setLoading(true);
    const action = mode === "create" ? createAccountAction : updateAccountAction;
    const result = await action(formData);
    setLoading(false);

    if (result.success) {
      toast({
        title: mode === "create" ? "账户创建成功" : "账户更新成功",
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
      {mode === "edit" && account && (
        <input type="hidden" name="id" value={account.id} />
      )}
      <div className="space-y-2">
        <Label htmlFor="name">账户名称</Label>
        <Input
          id="name"
          name="name"
          required
          placeholder="例如: 微信、KBank"
          defaultValue={account?.name ?? ""}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="currency">币种</Label>
        <Select
          id="currency"
          name="currency"
          defaultValue={account?.currency ?? "CNY"}
        >
          {SUPPORTED_CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.code} - {c.name} ({c.symbol})
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="account_type">账户类型</Label>
        <Select
          id="account_type"
          name="account_type"
          defaultValue={account?.account_type ?? ""}
        >
          <option value="">选择类型</option>
          {ACCOUNT_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="initial_balance">初始余额</Label>
        <Input
          id="initial_balance"
          name="initial_balance"
          type="number"
          step="0.0001"
          placeholder="0.00"
          defaultValue={account?.initial_balance ?? "0"}
        />
        <p className="text-xs text-muted-foreground">
          余额 = 初始余额 + 所有交易金额之和
        </p>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onClose}>
          取消
        </Button>
        <Button type="submit" loading={loading}>
          {mode === "create" ? "创建" : "保存"}
        </Button>
      </div>
    </form>
  );
}
