import { getFormData } from "@/features/transactions/queries";
import { getLatestRate } from "@/features/exchange-rates/queries";
import { ExchangePageClient } from "./exchange-page-client";

export default async function ExchangePage() {
  const { accounts, baseCurrency, latestRate } = await getFormData();
  const rate = await getLatestRate(baseCurrency, baseCurrency === "CNY" ? "THB" : "CNY");

  return (
    <ExchangePageClient
      accounts={accounts}
      baseCurrency={baseCurrency}
      latestRate={rate?.rate ?? latestRate}
    />
  );
}
