"use client";

import * as React from "react";
import { ArrowUpDown, Save } from "lucide-react";
import Decimal from "decimal.js";
import {
  convertAmount,
  roundAmount,
} from "@/lib/currency/convert";
import {
  formatCurrency,
  formatRate,
  getCurrencySymbol,
} from "@/lib/currency/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { saveExchangeRateAction } from "@/features/exchange-rates/actions";
import { SUPPORTED_CURRENCIES } from "@/types/transaction";

interface ConverterWidgetProps {
  baseCurrency: string;
  quoteCurrency: string;
  currentRate: string | null;
}

type LastEdited = "base" | "quote";

export function ConverterWidget({
  baseCurrency: initialBase,
  quoteCurrency: initialQuote,
  currentRate: initialRate,
}: ConverterWidgetProps) {
  const { toast } = useToast();
  const [baseCurrency, setBaseCurrency] = React.useState(initialBase);
  const [quoteCurrency, setQuoteCurrency] = React.useState(initialQuote);
  const [rate, setRate] = React.useState(
    initialRate ?? "4.8000"
  );
  const [baseAmount, setBaseAmount] = React.useState("");
  const [quoteAmount, setQuoteAmount] = React.useState("");
  const [lastEdited, setLastEdited] = React.useState<LastEdited>("base");
  const [hasRateOverride, setHasRateOverride] = React.useState(false);

  // When rate changes, recompute based on last edited field
  React.useEffect(() => {
    if (lastEdited === "base" && baseAmount) {
      recomputeFromBase(baseAmount);
    } else if (lastEdited === "quote" && quoteAmount) {
      recomputeFromQuote(quoteAmount);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate]);

  function recomputeFromBase(val: string) {
    if (!val || isNaN(Number(val))) {
      setQuoteAmount("");
      return;
    }
    // base -> quote: multiply by rate
    const result = convertAmount(
      val,
      rate,
      baseCurrency,
      quoteCurrency,
      baseCurrency
    );
    setQuoteAmount(roundAmount(result).toString());
  }

  function recomputeFromQuote(val: string) {
    if (!val || isNaN(Number(val))) {
      setBaseAmount("");
      return;
    }
    // quote -> base: divide by rate
    const result = convertAmount(
      val,
      rate,
      quoteCurrency,
      baseCurrency,
      baseCurrency
    );
    setBaseAmount(roundAmount(result).toString());
  }

  function handleBaseChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setBaseAmount(val);
    setLastEdited("base");
    recomputeFromBase(val);
  }

  function handleQuoteChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setQuoteAmount(val);
    setLastEdited("quote");
    recomputeFromQuote(val);
  }

  function handleRateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setRate(val);
    setHasRateOverride(true);
  }

  function handleSwap() {
    // Swap base and quote currencies
    const newBase = quoteCurrency;
    const newQuote = baseCurrency;
    // Invert the rate: if 1 CNY = 4.8 THB, after swap 1 THB = 1/4.8 CNY
    const newRate = rate && Number(rate) > 0
      ? new Decimal(1).dividedBy(new Decimal(rate)).toDecimalPlaces(8).toString()
      : rate;

    setBaseCurrency(newBase);
    setQuoteCurrency(newQuote);
    setRate(newRate);

    // Swap the amounts too
    const tempBase = baseAmount;
    const tempQuote = quoteAmount;
    setBaseAmount(tempQuote);
    setQuoteAmount(tempBase);
    setLastEdited("base");
    setHasRateOverride(true);
  }

  async function handleSaveRate() {
    const formData = new FormData();
    formData.set("base_currency", baseCurrency);
    formData.set("quote_currency", quoteCurrency);
    formData.set("rate", rate);

    const result = await saveExchangeRateAction(formData);
    if (result.success) {
      toast({
        title: "汇率已保存",
        description: `1 ${baseCurrency} = ${formatRate(rate, { dp: 4 })} ${quoteCurrency}`,
        variant: "success",
      });
      setHasRateOverride(false);
    } else {
      toast({
        title: "保存失败",
        description: result.error,
        variant: "destructive",
      });
    }
  }

  const expectedQuote = baseAmount && rate
    ? formatCurrency(
        convertAmount(baseAmount, rate, baseCurrency, quoteCurrency, baseCurrency),
        quoteCurrency
      )
    : null;

  return (
    <div className="space-y-6 max-w-md mx-auto">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">汇率换算器</h1>
        <p className="text-sm text-muted-foreground mt-1">
          仅做计算参考，不会创建任何交易记录
        </p>
      </div>

      <Card>
        <CardContent className="space-y-4 pt-6">
          {/* Base currency input */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>人民币 {baseCurrency}</span>
              <span className="text-xs text-muted-foreground">
                {getCurrencySymbol(baseCurrency)}
              </span>
            </Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="0.00"
              value={baseAmount}
              onChange={handleBaseChange}
              className="text-lg"
            />
          </div>

          {/* Swap button */}
          <div className="flex justify-center">
            <button
              onClick={handleSwap}
              className="rounded-full p-2 border bg-card hover:bg-accent transition-colors"
              title="交换币种"
            >
              <ArrowUpDown className="h-4 w-4" />
            </button>
          </div>

          {/* Quote currency input */}
          <div className="space-y-2">
            <Label className="flex items-center justify-between">
              <span>泰铢 {quoteCurrency}</span>
              <span className="text-xs text-muted-foreground">
                {getCurrencySymbol(quoteCurrency)}
              </span>
            </Label>
            <Input
              type="number"
              step="0.0001"
              placeholder="0.00"
              value={quoteAmount}
              onChange={handleQuoteChange}
              className="text-lg"
            />
          </div>
        </CardContent>
      </Card>

      {/* Rate editor */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            当前汇率
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs">1 {baseCurrency} =</Label>
              <Input
                type="number"
                step="0.00000001"
                value={rate}
                onChange={handleRateChange}
                className="text-sm"
              />
            </div>
            <span className="text-sm font-medium pb-2">{quoteCurrency}</span>
          </div>

          {hasRateOverride && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" onClick={handleSaveRate}>
                <Save className="h-3 w-3 mr-1" /> 保存为当前汇率
              </Button>
              <Badge variant="warning" className="text-xs">
                临时汇率
              </Badge>
            </div>
          )}

          {/* Expected output hint */}
          {baseAmount && rate && (
            <p className="text-xs text-muted-foreground pt-2 border-t">
              预计到账: {expectedQuote}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
