"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus,
  ArrowLeftRight,
  RefreshCw,
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TransactionForm } from "@/components/transaction/transaction-form";
import { TransferForm } from "@/components/transaction/transfer-form";
import { ExchangeForm } from "@/components/exchange/exchange-form";
import { formatCurrency, formatRate } from "@/lib/currency/format";
import type { Account, Category, Transaction } from "@/types/database";

interface DashboardClientProps {
  totalAssets: {
    totalBase: string;
    byCurrency: { currency: string; balance: string; baseEquivalent: string }[];
    rate: string | null;
    baseCurrency: string;
    quoteCurrency: string;
  };
  monthlySummary: {
    incomeBase: string;
    expenseBase: string;
    incomeByCurrency: { currency: string; amount: string }[];
    expenseByCurrency: { currency: string; amount: string }[];
  };
  categoryStats: {
    expenseByCategory: {
      categoryId: string;
      categoryName: string;
      icon: string | null;
      color: string | null;
      amount: string;
      percentage: number;
    }[];
    totalExpense: string;
  };
  recentTransactions: (Transaction & { account_name?: string; category_name?: string | null })[];
  formData: {
    accounts: Account[];
    expenseCategories: Category[];
    incomeCategories: Category[];
    baseCurrency: string;
    latestRate: string;
  };
}

type DialogType = "transaction" | "transfer" | "exchange" | null;

export function DashboardClient({
  totalAssets,
  monthlySummary,
  categoryStats,
  recentTransactions,
  formData,
}: DashboardClientProps) {
  const [dialogType, setDialogType] = React.useState<DialogType>(null);

  const closeDialog = () => setDialogType(null);

  const incomeNum = Number(monthlySummary.incomeBase);
  const expenseNum = Number(monthlySummary.expenseBase);
  const netAmount = incomeNum - expenseNum;
  const totalBaseNum = Number(totalAssets.totalBase);

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3">
        <QuickActionButton
          icon={<Plus className="h-5 w-5" />}
          label="记一笔"
          onClick={() => setDialogType("transaction")}
          variant="default"
        />
        <QuickActionButton
          icon={<ArrowLeftRight className="h-5 w-5" />}
          label="转账"
          onClick={() => setDialogType("transfer")}
          variant="outline"
        />
        <QuickActionButton
          icon={<RefreshCw className="h-5 w-5" />}
          label="换汇"
          onClick={() => setDialogType("exchange")}
          variant="outline"
        />
        <Link href="/converter">
          <QuickActionButton
            icon={<Calculator className="h-5 w-5" />}
            label="汇率换算"
            variant="outline"
          />
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        {/* Total Assets */}
        <Card className="md:col-span-1">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                总资产
              </CardTitle>
              <Wallet className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {formatCurrency(totalBaseNum, totalAssets.baseCurrency)}
            </p>
            {totalAssets.byCurrency.length > 1 && (
              <div className="mt-2 space-y-1">
                {totalAssets.byCurrency.map((item) => (
                  <div key={item.currency} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.currency}</span>
                    <span>{formatCurrency(item.balance, item.currency)}</span>
                  </div>
                ))}
                {totalAssets.rate && (
                  <div className="flex justify-between text-xs text-muted-foreground pt-1 border-t">
                    <span>当前汇率</span>
                    <span>1 {totalAssets.baseCurrency} = {formatRate(totalAssets.rate)} {totalAssets.quoteCurrency}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Income */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月收入
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-success" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {formatCurrency(incomeNum, totalAssets.baseCurrency, { showSign: true })}
            </p>
            {monthlySummary.incomeByCurrency.length > 0 && (
              <div className="mt-2 space-y-1">
                {monthlySummary.incomeByCurrency.map((item) => (
                  <div key={item.currency} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.currency}</span>
                    <span>{formatCurrency(item.amount, item.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Expense */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                本月支出
              </CardTitle>
              <TrendingDown className="h-4 w-4 text-destructive" />
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">
              {formatCurrency(Math.abs(expenseNum), totalAssets.baseCurrency)}
            </p>
            {monthlySummary.expenseByCurrency.length > 0 && (
              <div className="mt-2 space-y-1">
                {monthlySummary.expenseByCurrency.map((item) => (
                  <div key={item.currency} className="flex justify-between text-xs text-muted-foreground">
                    <span>{item.currency}</span>
                    <span>{formatCurrency(Math.abs(Number(item.amount)), item.currency)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Net Income Bar */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">本月净收支</span>
            <span className={`text-lg font-bold ${netAmount >= 0 ? "text-success" : "text-destructive"}`}>
              {formatCurrency(netAmount, totalAssets.baseCurrency, { showSign: true })}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Category Stats + Recent Transactions */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Category Breakdown */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>支出分类</CardTitle>
              <Link href="/statistics" className="text-xs text-primary hover:underline">
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {categoryStats.expenseByCategory.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                本月暂无支出记录
              </p>
            ) : (
              <div className="space-y-3">
                {categoryStats.expenseByCategory.map((cat) => (
                  <div key={cat.categoryId} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        {cat.color && (
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ backgroundColor: cat.color }}
                          />
                        )}
                        <span>{cat.categoryName}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">{cat.percentage}%</span>
                        <span className="font-medium">
                          {formatCurrency(cat.amount, totalAssets.baseCurrency)}
                        </span>
                      </div>
                    </div>
                    {/* Progress bar */}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${cat.percentage}%`,
                          backgroundColor: cat.color ?? "var(--primary)",
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>最近账单</CardTitle>
              <Link href="/transactions" className="text-xs text-primary hover:underline">
                查看全部
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {recentTransactions.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-sm text-muted-foreground mb-3">暂无交易记录</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDialogType("transaction")}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  记一笔
                </Button>
              </div>
            ) : (
              <div className="space-y-1">
                {recentTransactions.map((txn) => (
                  <RecentTransactionItem key={txn.id} txn={txn} baseCurrency={totalAssets.baseCurrency} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <Dialog open={dialogType === "transaction"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogHeader>
          <DialogTitle>记一笔</DialogTitle>
          <DialogDescription>记录一笔收入或支出</DialogDescription>
        </DialogHeader>
        <TransactionForm
          mode="create"
          accounts={formData.accounts}
          expenseCategories={formData.expenseCategories}
          incomeCategories={formData.incomeCategories}
          baseCurrency={formData.baseCurrency}
          latestRate={formData.latestRate}
          onClose={closeDialog}
        />
      </Dialog>

      <Dialog open={dialogType === "transfer"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogHeader>
          <DialogTitle>转账</DialogTitle>
          <DialogDescription>同币种账户间转账</DialogDescription>
        </DialogHeader>
        <TransferForm accounts={formData.accounts} onClose={closeDialog} />
      </Dialog>

      <Dialog open={dialogType === "exchange"} onOpenChange={(o) => !o && closeDialog()}>
        <DialogHeader>
          <DialogTitle>换汇</DialogTitle>
          <DialogDescription>跨币种账户间兑换</DialogDescription>
        </DialogHeader>
        <ExchangeForm
          accounts={formData.accounts}
          baseCurrency={formData.baseCurrency}
          latestRate={formData.latestRate}
          onClose={closeDialog}
        />
      </Dialog>
    </div>
  );
}

function QuickActionButton({
  icon,
  label,
  onClick,
  variant = "outline",
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  variant?: "default" | "outline";
}) {
  return (
    <Button
      variant={variant}
      className="flex flex-col items-center gap-1 h-auto py-3"
      onClick={onClick}
    >
      {icon}
      <span className="text-xs">{label}</span>
    </Button>
  );
}

function RecentTransactionItem({
  txn,
  baseCurrency,
}: {
  txn: Transaction & { account_name?: string; category_name?: string | null };
  baseCurrency: string;
}) {
  const amount = Number(txn.amount);
  const isExpense = txn.transaction_type === "expense";
  const isIncome = txn.transaction_type === "income";
  const isTransfer = txn.transaction_type === "transfer";
  const isExchange = txn.transaction_type === "exchange";

  const typeColor = isExpense
    ? "text-destructive"
    : isIncome
    ? "text-success"
    : "text-muted-foreground";

  const typeLabel = isExpense
    ? "支出"
    : isIncome
    ? "收入"
    : isTransfer
    ? "转账"
    : "换汇";

  const displayAmount = isExpense ? Math.abs(amount) : amount;

  return (
    <Link
      href="/transactions"
      className="flex items-center justify-between gap-2 rounded-md px-2 py-2 hover:bg-accent/50 transition-colors"
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className="flex flex-col items-center justify-center w-10 h-10 rounded-full bg-muted shrink-0">
          <span className="text-xs text-muted-foreground">
            {txn.transaction_date.slice(5, 7)}/{txn.transaction_date.slice(8, 10)}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium truncate">
              {txn.category_name ?? typeLabel}
            </span>
            <Badge variant="secondary" className="shrink-0 text-[10px] px-1.5 py-0">
              {typeLabel}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">
            {txn.account_name}
            {txn.note ? ` · ${txn.note}` : ""}
          </p>
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${typeColor}`}>
          {isExpense ? "-" : isIncome ? "+" : ""}
          {formatCurrency(displayAmount, txn.currency)}
        </p>
        {txn.currency !== baseCurrency && (
          <p className="text-xs text-muted-foreground">
            ≈ {formatCurrency(txn.base_amount, baseCurrency)}
          </p>
        )}
      </div>
    </Link>
  );
}
