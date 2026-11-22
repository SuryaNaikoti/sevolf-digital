export const CURRENCIES = {
  INR: { symbol: "₹", code: "INR", rate: 1, label: "INR (₹)" },
  USD: { symbol: "$", code: "USD", rate: 0.012, label: "USD ($)" },
  GBP: { symbol: "£", code: "GBP", rate: 0.0095, label: "GBP (£)" },
  EUR: { symbol: "€", code: "EUR", rate: 0.011, label: "EUR (€)" },
} as const;

export type CurrencyCode = keyof typeof CURRENCIES;

/**
 * Format price cleanly and consistently without arbitrary conversions.
 * Supports base currency display with appropriate international symbols.
 */
export function formatPrice(amountInINR: number, currency: CurrencyCode = "INR"): string {
  const curr = CURRENCIES[currency] || CURRENCIES.INR;
  const converted = Math.round(amountInINR * curr.rate);
  
  if (currency === "INR") {
    return `₹${amountInINR.toLocaleString("en-IN")}`;
  } else if (currency === "USD") {
    return `$${(amountInINR * 0.012).toFixed(2)}`;
  } else if (currency === "GBP") {
    return `£${(amountInINR * 0.0095).toFixed(2)}`;
  } else if (currency === "EUR") {
    return `€${(amountInINR * 0.011).toFixed(2)}`;
  }

  return `${curr.symbol}${converted}`;
}
