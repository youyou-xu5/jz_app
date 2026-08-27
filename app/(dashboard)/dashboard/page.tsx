import { getDashboardData } from "@/features/dashboard/queries";
import { getFormData } from "@/features/transactions/queries";
import { DashboardClient } from "@/components/dashboard/dashboard-client";

export default async function DashboardPage() {
  const [dashboardData, formData] = await Promise.all([
    getDashboardData(),
    getFormData(),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">概览</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理你的双币种财务
          </p>
        </div>
      </div>

      <DashboardClient
        totalAssets={dashboardData.totalAssets}
        monthlySummary={dashboardData.monthlySummary}
        categoryStats={dashboardData.categoryStats}
        recentTransactions={dashboardData.recentTransactions}
        formData={{
          accounts: formData.accounts,
          expenseCategories: formData.expenseCategories,
          incomeCategories: formData.incomeCategories,
          baseCurrency: formData.baseCurrency,
          latestRate: formData.latestRate,
        }}
      />
    </div>
  );
}
