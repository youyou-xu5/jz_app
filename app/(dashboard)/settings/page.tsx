import { createClient } from "@/lib/supabase/server";
import { getCategories } from "@/features/categories/queries";
import {
  getLatestRate,
  getRateHistory,
  getBaseCurrency,
} from "@/features/exchange-rates/queries";
import { CategoryManager } from "@/components/category/category-manager";
import { RateManager } from "@/components/exchange/rate-manager";
import { SettingsClient } from "@/components/settings/settings-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  const { expense, income } = await getCategories();

  const baseCurrency = await getBaseCurrency();
  const quoteCurrency = baseCurrency === "CNY" ? "THB" : "CNY";
  const currentRate = await getLatestRate(baseCurrency, quoteCurrency);
  const history = await getRateHistory(baseCurrency, quoteCurrency);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">设置</h1>
      </div>

      {/* Profile + Export */}
      <SettingsClient
        profile={profile ?? {
          id: user.id,
          display_name: null,
          base_currency: "CNY",
          timezone: "Asia/Bangkok",
          created_at: "",
          updated_at: "",
        }}
        email={user.email ?? ""}
      />

      {/* Exchange Rate */}
      <RateManager
        baseCurrency={baseCurrency}
        quoteCurrency={quoteCurrency}
        currentRate={currentRate}
        history={history}
      />

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>分类管理</CardTitle>
        </CardHeader>
        <CardContent>
          <CategoryManager
            expenseCategories={expense}
            incomeCategories={income}
          />
        </CardContent>
      </Card>
    </div>
  );
}
