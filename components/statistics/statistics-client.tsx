"use client";

import * as React from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/currency/format";

interface StatisticsClientProps {
  monthlyTrend: {
    data: { year: number; month: number; label: string; income: number; expense: number; net: number }[];
  };
  categoryBreakdown: {
    data: { name: string; value: number; color: string | null; percentage: number }[];
    total: number;
  };
  currentYear: number;
  currentMonth: number;
  baseCurrency: string;
}

type ViewMode = "monthly" | "yearly";

const CHART_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#64748b", "#14b8a6", "#a855f7", "#f43f5e",
];

export function StatisticsClient({
  monthlyTrend,
  categoryBreakdown,
  currentYear,
  currentMonth,
  baseCurrency,
}: StatisticsClientProps) {
  const [viewMode, setViewMode] = React.useState<ViewMode>("monthly");
  const [selectedYear, setSelectedYear] = React.useState(currentYear);
  const [breakdownType, setBreakdownType] = React.useState<"expense" | "income">("expense");

  // Fetch yearly data when switching to yearly view
  const [yearlyData, setYearlyData] = React.useState<{
    data: { month: number; label: string; income: number; expense: number; net: number }[];
    totalIncome: number;
    totalExpense: number;
  } | null>(null);

  const [categoryData, setCategoryData] = React.useState(categoryBreakdown);

  React.useEffect(() => {
    if (viewMode === "yearly") {
      fetchYearlyData(selectedYear);
    }
  }, [viewMode, selectedYear]);

  async function fetchYearlyData(year: number) {
    try {
      const res = await fetch(`/api/statistics/yearly?year=${year}`);
      const data = await res.json();
      setYearlyData(data);
    } catch {
      setYearlyData(null);
    }
  }

  async function fetchCategoryBreakdown(year: number, month: number, type: "expense" | "income") {
    try {
      const res = await fetch(`/api/statistics/category?year=${year}&month=${month}&type=${type}`);
      const data = await res.json();
      setCategoryData(data);
    } catch {
      setCategoryData({ data: [], total: 0 });
    }
  }

  React.useEffect(() => {
    fetchCategoryBreakdown(currentYear, currentMonth, breakdownType);
  }, [breakdownType]); // eslint-disable-line react-hooks/exhaustive-deps

  const trendData = viewMode === "monthly" ? monthlyTrend.data : (yearlyData?.data ?? []);
  const totalIncome = viewMode === "monthly"
    ? monthlyTrend.data.reduce((sum, d) => sum + d.income, 0)
    : yearlyData?.totalIncome ?? 0;
  const totalExpense = viewMode === "monthly"
    ? monthlyTrend.data.reduce((sum, d) => sum + d.expense, 0)
    : yearlyData?.totalExpense ?? 0;

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant={viewMode === "monthly" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("monthly")}
        >
          近半年
        </Button>
        <Button
          variant={viewMode === "yearly" ? "default" : "outline"}
          size="sm"
          onClick={() => setViewMode("yearly")}
        >
          年度
        </Button>
        {viewMode === "yearly" && (
          <div className="flex items-center gap-1 ml-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedYear(selectedYear - 1)}
            >
              &lt;
            </Button>
            <span className="text-sm font-medium min-w-[60px] text-center">
              {selectedYear}年
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedYear(selectedYear + 1)}
            >
              &gt;
            </Button>
          </div>
        )}
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {viewMode === "monthly" ? "半年总收支" : "年度总收支"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold">
              {formatCurrency(totalIncome - totalExpense, baseCurrency, { showSign: true })}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {viewMode === "monthly" ? "半年总收入" : "年度总收入"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-success">
              {formatCurrency(totalIncome, baseCurrency)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {viewMode === "monthly" ? "半年总支出" : "年度总支出"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xl font-bold text-destructive">
              {formatCurrency(totalExpense, baseCurrency)}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>收支趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              />
              <Legend />
              <Bar dataKey="income" name="收入" fill="var(--color-success, #22c55e)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" name="支出" fill="var(--color-destructive, #ef4444)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Net Trend Line Chart */}
      <Card>
        <CardHeader>
          <CardTitle>结余趋势</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="label" tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <YAxis tick={{ fontSize: 12 }} stroke="var(--muted-foreground)" />
              <Tooltip
                formatter={(value: number) => formatCurrency(value, baseCurrency)}
                contentStyle={{
                  backgroundColor: "var(--card)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                }}
              />
              <Line
                type="monotone"
                dataKey="net"
                name="结余"
                stroke="var(--primary, #3b82f6)"
                strokeWidth={2}
                dot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>分类占比</CardTitle>
            <div className="flex gap-1">
              <Button
                variant={breakdownType === "expense" ? "default" : "outline"}
                size="sm"
                onClick={() => setBreakdownType("expense")}
              >
                支出
              </Button>
              <Button
                variant={breakdownType === "income" ? "default" : "outline"}
                size="sm"
                onClick={() => setBreakdownType("income")}
              >
                收入
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {categoryData.data.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              本月暂无{breakdownType === "expense" ? "支出" : "收入"}记录
            </p>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {/* Pie Chart */}
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData.data}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ percentage }: { percentage: number }) => `${percentage}%`}
                  >
                    {categoryData.data.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value, baseCurrency)}
                    contentStyle={{
                      backgroundColor: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>

              {/* Category List */}
              <div className="space-y-2">
                {categoryData.data.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between gap-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="inline-block h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: item.color ?? CHART_COLORS[index % CHART_COLORS.length] }}
                      />
                      <span className="truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-muted-foreground">{item.percentage}%</span>
                      <span className="font-medium">
                        {formatCurrency(item.value, baseCurrency)}
                      </span>
                    </div>
                  </div>
                ))}
                <div className="flex items-center justify-between pt-2 border-t text-sm font-semibold">
                  <span>总计</span>
                  <span>{formatCurrency(categoryData.total, baseCurrency)}</span>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
