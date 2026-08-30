// Every price in the app's mock data (flights, hotels, activities, budget
// math) is generated in USD — see the `currency: "USD"` fields on
// FlightOption/HotelOption/ActivityOption in types/trip.ts. This table lets
// the UI display those USD amounts converted to a traveller's preferred
// currency. Rates are approximate, hand-maintained snapshots (not live) —
// fine for a planning estimate, not for anything transactional.
export interface CurrencyDef {
  code: string;
  symbol: string;
  name: string;
  usdRate: number; // units of this currency per 1 USD
}

export const CURRENCIES: CurrencyDef[] = [
  { code: "USD", symbol: "$",  name: "US Dollar",         usdRate: 1 },
  { code: "EUR", symbol: "€",  name: "Euro",              usdRate: 0.92 },
  { code: "GBP", symbol: "£",  name: "British Pound",     usdRate: 0.78 },
  { code: "JPY", symbol: "¥",  name: "Japanese Yen",      usdRate: 149 },
  { code: "CAD", symbol: "$",  name: "Canadian Dollar",   usdRate: 1.37 },
  { code: "AUD", symbol: "$",  name: "Australian Dollar", usdRate: 1.52 },
  { code: "MXN", symbol: "$",  name: "Mexican Peso",      usdRate: 17.1 },
  { code: "CHF", symbol: "Fr", name: "Swiss Franc",       usdRate: 0.88 },
  { code: "CNY", symbol: "¥",  name: "Chinese Yuan",      usdRate: 7.24 },
  { code: "INR", symbol: "₹",  name: "Indian Rupee",      usdRate: 83.4 },
  { code: "THB", symbol: "฿",  name: "Thai Baht",         usdRate: 34.8 },
  { code: "NZD", symbol: "$",  name: "New Zealand Dollar", usdRate: 1.64 },
];

export function getCurrency(code?: string): CurrencyDef {
  return CURRENCIES.find((c) => c.code === code) ?? CURRENCIES[0];
}

export function convertFromUsd(amountUsd: number, code?: string): number {
  return amountUsd * getCurrency(code).usdRate;
}
