"use client";

import * as React from "react";
import Decimal from "decimal.js";
import {
  convertAmount,
  roundAmount,
} from "@/lib/currency/convert";

interface UseConverterOptions {
  baseCurrency: string;
  quoteCurrency: string;
  initialRate: string;
}

/**
 * Hook for dual-input currency converter.
 * Manages the lastEditedField to avoid infinite update loops.
 *
 * Usage:
 *   const { baseAmount, quoteAmount, rate, setBaseAmount, setQuoteAmount, setRate, swap } = useConverter({...})
 */
export function useConverter({
  baseCurrency,
  quoteCurrency,
  initialRate,
}: UseConverterOptions) {
  const [rate, setRate] = React.useState(initialRate);
  const [baseAmount, setBaseAmountState] = React.useState("");
  const [quoteAmount, setQuoteAmountState] = React.useState("");
  const lastEditedRef = React.useRef<"base" | "quote">("base");

  // Recalculate when rate changes (unless it was the rate itself being edited by user)
  const rateRef = React.useRef(rate);
  const [rateChanged, setRateChanged] = React.useState(0);

  React.useEffect(() => {
    if (rateRef.current === rate) return;
    rateRef.current = rate;
    if (lastEditedRef.current === "base" && baseAmount) {
      const result = convertAmount(baseAmount, rate, baseCurrency, quoteCurrency, baseCurrency);
      setQuoteAmountState(roundAmount(result).toString());
    } else if (lastEditedRef.current === "quote" && quoteAmount) {
      const result = convertAmount(quoteAmount, rate, quoteCurrency, baseCurrency, baseCurrency);
      setBaseAmountState(roundAmount(result).toString());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rate, rateChanged]);

  const setBaseAmount = (val: string) => {
    lastEditedRef.current = "base";
    setBaseAmountState(val);
    if (!val || isNaN(Number(val))) {
      setQuoteAmountState("");
      return;
    }
    const result = convertAmount(val, rate, baseCurrency, quoteCurrency, baseCurrency);
    setQuoteAmountState(roundAmount(result).toString());
  };

  const setQuoteAmount = (val: string) => {
    lastEditedRef.current = "quote";
    setQuoteAmountState(val);
    if (!val || isNaN(Number(val))) {
      setBaseAmountState("");
      return;
    }
    const result = convertAmount(val, rate, quoteCurrency, baseCurrency, baseCurrency);
    setBaseAmountState(roundAmount(result).toString());
  };

  const setRateValue = (val: string) => {
    setRate(val);
    setRateChanged((n) => n + 1);
  };

  const swap = () => {
    const newBase = quoteCurrency;
    const newQuote = baseCurrency;
    const newRate = rate && Number(rate) > 0
      ? new Decimal(1).dividedBy(new Decimal(rate)).toDecimalPlaces(8).toString()
      : rate;

    const tempBase = baseAmount;
    const tempQuote = quoteAmount;

    // We need to rebuild state — use a batch approach
    setBaseAmountState(tempQuote);
    setQuoteAmountState(tempBase);
    setRate(newRate);
    setRateChanged((n) => n + 1);
    lastEditedRef.current = "base";

    // The currencies need to be swapped externally — this hook doesn't manage them
    // The component should call setBaseCurrency/setQuoteCurrency separately
  };

  return {
    rate,
    baseAmount,
    quoteAmount,
    setBaseAmount,
    setQuoteAmount,
    setRate: setRateValue,
    swap,
  };
}
