/**
 * SEVOLF DIGITAL — FINANCIAL CALCULATION ENGINE
 *
 * Implements exact integer minor-unit and decimal-safe arithmetic
 * without floating-point representation errors.
 *
 * CANONICAL RULES:
 * 1. Base Currency: INR (Indian Rupee).
 * 2. Charged Currencies: INR (Domestic) or USD (International).
 * 3. Monetary Scale:
 *    - INR: 1 Rupee = 100 paise (2 decimal places)
 *    - USD: 1 Dollar = 100 cents (2 decimal places)
 * 4. Exchange Rate Scale: 6 decimal places (e.g., 0.012000 USD/INR).
 * 5. Rounding: Standard half-up financial rounding at minor unit boundaries.
 */

export interface OrderMonetaryCalculation {
  baseCurrency: "INR";
  baseSubtotalDecimal: number;       // e.g. 1299.00
  baseSubtotalPaise: number;         // e.g. 129900
  chargedCurrency: "INR" | "USD";
  exchangeRateUsed: number;          // e.g. 1.000000 or 0.012000
  chargedSubtotalDecimal: number;    // e.g. 15.59
  chargedSubtotalMinorUnits: number; // e.g. 1559
  discountDecimal: number;           // e.g. 0.00
  discountMinorUnits: number;        // e.g. 0
  totalAmountDecimal: number;        // e.g. 15.59
  totalAmountMinorUnits: number;     // e.g. 1559
}

/**
 * Parses string or numeric currency amount into exact integer minor units (paise/cents)
 * completely avoiding floating-point multiplication errors (e.g. 15.58 * 100 = 1557.9999999999998)
 */
export function toMinorUnits(amount: number | string): number {
  const str = typeof amount === "number" ? amount.toFixed(4) : amount.trim();
  const [whole, fraction = ""] = str.split(".");
  const cents = (fraction + "0000").slice(0, 4); // 4 digits precision
  const centsNum = parseInt(cents.slice(0, 2), 10);
  const roundFraction = parseInt(cents.slice(2, 4), 10);
  const isNegative = whole.startsWith("-");
  const wholeVal = Math.abs(parseInt(whole, 10)) * 100;
  
  let result = wholeVal + centsNum;
  if (roundFraction >= 50) {
    result += 1;
  }
  return isNegative ? -result : result;
}

/**
 * Formats integer minor units back to 2-decimal string
 */
export function fromMinorUnits(minorUnits: number): string {
  const isNegative = minorUnits < 0;
  const abs = Math.abs(minorUnits);
  const whole = Math.floor(abs / 100);
  const fraction = (abs % 100).toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
}

/**
 * Computes exact order monetary figures based on base items, exchange rate, and discount
 */
export function calculateOrderAmounts(
  items: Array<{ unitPriceINR: number; quantity: number }>,
  chargedCurrency: "INR" | "USD",
  exchangeRate: number = 1.0,
  discountINR: number = 0
): OrderMonetaryCalculation {
  // 1. Calculate base INR subtotal in paise (integer)
  let baseSubtotalPaise = 0;
  for (const item of items) {
    const itemPaise = toMinorUnits(item.unitPriceINR);
    baseSubtotalPaise += itemPaise * item.quantity;
  }

  const baseSubtotalDecimal = parseFloat(fromMinorUnits(baseSubtotalPaise));

  // 2. Conversion and Charged Subtotal
  let exchangeRateUsed = 1.0;
  let chargedSubtotalMinorUnits = baseSubtotalPaise;

  if (chargedCurrency === "USD") {
    exchangeRateUsed = exchangeRate;
    // Compute in micro-cents (scale 10^6) to preserve 6-decimal exchange rate precision
    // chargedCents = Math.round((basePaise * exchangeRate) / 1)
    const rateMicro = Math.round(exchangeRate * 1_000_000);
    // baseSubtotalPaise * rateMicro / 1,000,000 gives exact cents
    chargedSubtotalMinorUnits = Math.round((baseSubtotalPaise * rateMicro) / 1_000_000);
  }

  const chargedSubtotalDecimal = parseFloat(fromMinorUnits(chargedSubtotalMinorUnits));

  // 3. Discount calculation in charged currency
  let discountMinorUnits = 0;
  if (discountINR > 0) {
    if (chargedCurrency === "INR") {
      discountMinorUnits = toMinorUnits(discountINR);
    } else {
      const rateMicro = Math.round(exchangeRate * 1_000_000);
      const discountPaise = toMinorUnits(discountINR);
      discountMinorUnits = Math.round((discountPaise * rateMicro) / 1_000_000);
    }
  }
  const discountDecimal = parseFloat(fromMinorUnits(discountMinorUnits));

  // 4. Total Amount
  const totalAmountMinorUnits = Math.max(0, chargedSubtotalMinorUnits - discountMinorUnits);
  const totalAmountDecimal = parseFloat(fromMinorUnits(totalAmountMinorUnits));

  return {
    baseCurrency: "INR",
    baseSubtotalDecimal,
    baseSubtotalPaise,
    chargedCurrency,
    exchangeRateUsed,
    chargedSubtotalDecimal,
    chargedSubtotalMinorUnits,
    discountDecimal,
    discountMinorUnits,
    totalAmountDecimal,
    totalAmountMinorUnits,
  };
}
