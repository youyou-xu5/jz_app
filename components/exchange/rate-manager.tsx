"use client";

import * as React from "react";
import { formatDate } from "@/lib/utils/date";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveExchangeRateAction } from "@/features/exchange-rates/actions";
import { formatRate } from "@/lib/currency/format";
import type { ExchangeRate } from "@/types/database";

interface RateManagerProps {
  baseCurrency: string;
  quoteCurrency: string;
  currentRate: ExchangeRate | null;
  history: ExchangeRate[];
}

export function RateManager({
  baseCurrency,
  quoteCurrency,
  currentRate,
  history,
}: RateManagerProps) {
  const { toast } = useToast();
  const [rate, setRate] = React.useState(
    currentRate ? formatRate(currentRate.rate) : ""
  );

  React.useEffect(() => {
    setRate(currentRate ? formatRate(currentRate.rate) : "");
  }, [currentRate]);

  async function handleSubmit(formData: FormData) {
    const result = await saveExchangeRateAction(formData);
    if (result.success) {
      toast({
        title: "汇率已保存",
        description: `1 ${baseCurrency} = ${formData.get("rate")} ${quoteCurrency}`,
        variant: "success",
      });
    } else {
      toast({
        title: "保存失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>汇率管理</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current rate */}
        <div className="space-y-2">
          <Label>当前汇率</Label>
          {currentRate ? (
            <div className="flex items-center gap-2">
              <Badge variant="secondary">
                1 {baseCurrency} = {formatRate(currentRate.rate, { dp: 4 })} {quoteCurrency}
              </Badge>
              <span className="text-xs text-muted-foreground">
                更新于 {formatDate(currentRate.effective_at, "yyyy-MM-dd HH:mm")}
              </span>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              尚未设置汇率
            </p>
          )}
        </div>

        {/* Edit rate */}
        <form action={handleSubmit} className="space-y-3">
          <input type="hidden" name="base_currency" value={baseCurrency} />
          <input type="hidden" name="quote_currency" value={quoteCurrency} />
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label htmlFor="rate">
                1 {baseCurrency} =
              </Label>
              <Input
                id="rate"
                name="rate"
                type="number"
                step="0.00000001"
                min="0"
                required
                value={rate}
                onChange={(e) => setRate(e.target.value)}
                placeholder="4.8000"
              />
            </div>
            <span className="text-sm font-medium pb-2">{quoteCurrency}</span>
            <Button type="submit">
              保存
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            保存后将新增一条汇率记录，不会覆盖历史数据
          </p>
        </form>

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2">
            <Label>汇率历史</Label>
            <div className="rounded-md border divide-y max-h-60 overflow-y-auto">
              {history.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm">
                      1 {r.base_currency} = {formatRate(r.rate, { dp: 4 })} {r.quote_currency}
                    </span>
                    {r.source === "manual" ? (
                      <Badge variant="outline" className="text-xs">手动</Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs">API</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(r.effective_at, "yyyy-MM-dd")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
