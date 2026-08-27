"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ExchangeForm } from "@/components/exchange/exchange-form";
import type { Account } from "@/types/database";

export function ExchangePageClient({
  accounts,
  baseCurrency,
  latestRate,
}: {
  accounts: Account[];
  baseCurrency: string;
  latestRate: string;
}) {
  const [showForm, setShowForm] = React.useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">换汇</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="h-4 w-4 mr-1" /> 换汇
        </Button>
      </div>

      {accounts.length < 2 ? (
        <div className="rounded-md border p-8 text-center">
          <p className="text-muted-foreground">
            需要至少两个不同币种的账户才能换汇。请先在账户页面创建。
          </p>
        </div>
      ) : (
        <div className="rounded-md border p-8 text-center">
          <p className="text-muted-foreground mb-4">
            点击"换汇"按钮创建一笔跨币种换汇记录
          </p>
          <p className="text-xs text-muted-foreground">
            换汇不计入收入/支出统计，但影响账户余额和资产估值
          </p>
        </div>
      )}

      {showForm && (
        <Dialog open={showForm} onOpenChange={setShowForm}>
          <ExchangeForm
            accounts={accounts}
            baseCurrency={baseCurrency}
            latestRate={latestRate}
            onClose={() => setShowForm(false)}
          />
        </Dialog>
      )}
    </div>
  );
}
