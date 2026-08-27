import { getStatisticsData } from "@/features/statistics/queries";
import { StatisticsClient } from "@/components/statistics/statistics-client";

export default async function StatisticsPage() {
  const data = await getStatisticsData();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">统计</h1>
          <p className="text-sm text-muted-foreground mt-1">
            收支趋势与分类分析
          </p>
        </div>
      </div>

      <StatisticsClient
        monthlyTrend={data.monthlyTrend}
        categoryBreakdown={data.categoryBreakdown}
        currentYear={data.currentYear}
        currentMonth={data.currentMonth}
        baseCurrency={data.baseCurrency}
      />
    </div>
  );
}
