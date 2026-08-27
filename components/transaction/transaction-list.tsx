"use client";

import * as React from "react";
import { Plus, ChevronLeft, ChevronRight, Search, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { TransactionForm } from "@/components/transaction/transaction-form";
import { formatCurrency } from "@/lib/currency/format";
import type { Account, Category } from "@/types/database";
import type { TransactionWithDetails } from "@/features/transactions/queries";

interface TransactionListProps {
  initialTransactions: TransactionWithDetails[];
  initialYear: number;
  initialMonth: number;
  accounts: Account[];
  allCategories: Category[];
  baseCurrency: string;
  latestRate: string;
  expenseCategories: Category[];
  incomeCategories: Category[];
}

export function TransactionList({
  initialTransactions,
  initialYear,
  initialMonth,
  accounts,
  allCategories,
  baseCurrency,
  latestRate,
  expenseCategories,
  incomeCategories,
}: TransactionListProps) {
  const [year, setYear] = React.useState(initialYear);
  const [month, setMonth] = React.useState(initialMonth);
  const [transactions, setTransactions] = React.useState(initialTransactions);
  const [loading, setLoading] = React.useState(false);
  const [showFilters, setShowFilters] = React.useState(false);
  const [showCreate, setShowCreate] = React.useState(false);

  // Filters
  const [transactionType, setTransactionType] = React.useState("all");
  const [accountId, setAccountId] = React.useState("all");
  const [categoryId, setCategoryId] = React.useState("all");
  const [currency, setCurrency] = React.useState("all");
  const [search, setSearch] = React.useState("");

  async function fetchTransactions(y: number, m: number) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        year: String(y),
        month: String(m),
        type: transactionType,
        account: accountId,
        category: categoryId,
        currency,
        search,
      });
      const res = await fetch(`/api/transactions?${params}`);
      const data = await res.json();
      setTransactions(data.transactions ?? []);
    } catch {
      setTransactions([]);
    } finally {
      setLoading(false);
    }
  }

  function handleMonthChange(delta: number) {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear++;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear--;
    }
    setMonth(newMonth);
    setYear(newYear);
    fetchTransactions(newYear, newMonth);
  }

  // Debounced search
  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions(year, month);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, transactionType, accountId, categoryId, currency]);

  // Group transactions by date
  const grouped = React.useMemo(() => {
    const map: Record<string, TransactionWithDetails[]> = {};
    for (const t of transactions) {
      if (!map[t.transaction_date]) map[t.transaction_date] = [];
      map[t.transaction_date].push(t);
    }
    return Object.entries(map).sort((a, b) => b[0].localeCompare(a[0]));
  }, [transactions]);

  // Compute totals for the month
  const monthTotals = React.useMemo(() => {
    let income = 0;
    let expense = 0;
    for (const t of transactions) {
      const amt = Number(t.base_amount);
      if (t.transaction_type === "income") income += amt;
      else if (t.transaction_type === "expense") expense += Math.abs(amt);
    }
    return { income, expense, net: income - expense };
  }, [transactions]);

  const monthNames = [
    "1月", "2月", "3月", "4月", "5月", "6月",
    "7月", "8月", "9月", "10月", "11月", "12月",
  ];

  return (
    <div className="space-y-4">
      {/* Month Navigator + Summary */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange(-1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-lg font-semibold min-w-[100px] text-center">
            {year}年 {monthNames[month - 1]}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleMonthChange(1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4 mr-1" />
          记一笔
        </Button>
      </div>

      {/* Monthly Summary Bar */}
      <Card>
        <CardContent className="py-3">
          <div className="flex items-center justify-around text-sm">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">收入</p>
              <p className="font-semibold text-success">
                {formatCurrency(monthTotals.income, baseCurrency)}
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">支出</p>
              <p className="font-semibold text-destructive">
                {formatCurrency(monthTotals.expense, baseCurrency)}
              </p>
            </div>
            <div className="h-8 w-px bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">结余</p>
              <p className={`font-semibold ${monthTotals.net >= 0 ? "text-success" : "text-destructive"}`}>
                {formatCurrency(monthTotals.net, baseCurrency, { showSign: true })}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters Toggle */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="搜索备注..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button
          variant={showFilters ? "default" : "outline"}
          size="icon"
          onClick={() => setShowFilters(!showFilters)}
        >
          <Filter className="h-4 w-4" />
        </Button>
      </div>

      {/* Filter Controls */}
      {showFilters && (
        <Card>
          <CardContent className="py-4 space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">类型</Label>
                <Select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                >
                  <option value="all">全部</option>
                  <option value="expense">支出</option>
                  <option value="income">收入</option>
                  <option value="transfer">转账</option>
                  <option value="exchange">换汇</option>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">账户</Label>
                <Select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                >
                  <option value="all">全部</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.currency})
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">分类</Label>
                <Select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                >
                  <option value="all">全部</option>
                  {allCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">币种</Label>
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  <option value="all">全部</option>
                  <option value="CNY">CNY</option>
                  <option value="THB">THB</option>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Transaction List Grouped by Date */}
      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">
          加载中...
        </div>
      ) : grouped.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-muted-foreground mb-3">本月暂无交易记录</p>
          <Button size="sm" variant="outline" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4 mr-1" />
            记一笔
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <div className="flex items-center justify-between mb-2 px-1">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {formatDateChinese(date)}
                </h3>
                <span className="text-xs text-muted-foreground">
                  {items.length} 笔
                </span>
              </div>
              <Card>
                <CardContent className="py-2 px-2">
                  <div className="divide-y">
                    {items.map((txn) => (
                      <TransactionRow
                        key={txn.id}
                        txn={txn}
                        baseCurrency={baseCurrency}
                      />
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      )}

      {/* Create Transaction Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogHeader>
          <DialogTitle>记一笔</DialogTitle>
          <DialogDescription>记录一笔收入或支出</DialogDescription>
        </DialogHeader>
        <TransactionForm
          mode="create"
          accounts={accounts}
          expenseCategories={expenseCategories}
          incomeCategories={incomeCategories}
          baseCurrency={baseCurrency}
          latestRate={latestRate}
          onClose={() => {
            setShowCreate(false);
            fetchTransactions(year, month);
          }}
        />
      </Dialog>
    </div>
  );
}

function TransactionRow({
  txn,
  baseCurrency,
}: {
  txn: TransactionWithDetails;
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

  const typeLabel = isExpense ? "支出" : isIncome ? "收入" : isTransfer ? "转账" : "换汇";
  const displayAmount = isExpense ? Math.abs(amount) : amount;

  return (
    <div className="flex items-center justify-between gap-2 py-2.5 px-2 hover:bg-accent/50 rounded-md transition-colors">
      <div className="flex items-center gap-3 min-w-0 flex-1">
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
    </div>
  );
}

function formatDateChinese(dateStr: string): string {
  const date = new Date(dateStr);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const weekday = weekdays[date.getDay()];
  return `${month}月${day}日 周${weekday}`;
}
