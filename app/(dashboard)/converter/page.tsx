import {
  getLatestRate,
  getBaseCurrency,
} from "@/features/exchange-rates/queries";
import { ConverterWidget } from "@/components/converter/converter-widget";

export default async function ConverterPage() {
  const baseCurrency = await getBaseCurrency();
  const quoteCurrency = baseCurrency === "CNY" ? "THB" : "CNY";
  const currentRate = await getLatestRate(baseCurrency, quoteCurrency);

  return (
    <div className="py-4">
      <ConverterWidget
        baseCurrency={baseCurrency}
        quoteCurrency={quoteCurrency}
        currentRate={currentRate?.rate ?? null}
      />
    </div>
  );
}
