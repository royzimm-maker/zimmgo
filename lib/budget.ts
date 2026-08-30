import { formatCurrency } from "@/lib/utils";
import type { FlightOption, HotelOption, ActivityOption, TripPreferences, BudgetRange } from "@/types/trip";

export type CabinClass = "economy" | "premium_economy" | "business" | "first";

export const CABIN_CLASS_LABELS: Record<CabinClass, string> = {
  economy: "Economy",
  premium_economy: "Premium Economy",
  business: "Business",
  first: "First Class",
};

// Rough price multipliers relative to economy — used only for the "what if I
// flew a different cabin" toggle in the budget breakdown. Real fares are
// looked up per cabin via search_flights during generation; this is just a
// ballpark for exploring the tradeoff without a new search.
export const CABIN_CLASS_MULTIPLIERS: Record<CabinClass, number> = {
  economy: 1,
  premium_economy: 1.6,
  business: 3,
  first: 4.5,
};

export function normalizeCabinClass(raw?: string): CabinClass {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("first")) return "first";
  if (s.includes("business")) return "business";
  if (s.includes("premium")) return "premium_economy";
  return "economy";
}

// Representative $/night for each Budget-step lodging tier — used for the
// "what if I picked a different lodging tier" toggle, in place of the actual
// searched-hotel average.
export const LODGING_TIER_NIGHTLY: Record<BudgetRange, number> = {
  under_500: 150,
  "500_750": 300,
  "750_1000": 550,
  "1000_plus": 900,
};

export const FOOD_TIER_PRESETS: { value: number; label: string }[] = [
  { value: 50, label: "$30–70/person/day" },
  { value: 100, label: "$70–150/person/day" },
  { value: 200, label: "$150–300/person/day" },
  { value: 400, label: "$300+/person/day" },
];

export const ACTIVITY_INTENSITY_PRESETS: { value: number; label: string }[] = [
  { value: 0.5, label: "Lighter pace" },
  { value: 1.5, label: "Packed pace" },
];

export interface BudgetLine {
  id: "flights" | "hotels" | "activities" | "food" | "transport" | "misc";
  label: string;
  amount: number;
  note: string;
}

export interface BudgetEstimate {
  lines: BudgetLine[];
  total: number;
  perPerson: number;
  travelers: number;
}

// Exploratory "what if" adjustments a user can apply in the budget breakdown
// UI — never persisted, purely a local recalculation against the same
// underlying search results.
export interface BudgetOverrides {
  cabinClass?: CabinClass;
  lodgingTier?: BudgetRange;
  dailyFoodBudgetPerPerson?: number;
  activityIntensity?: number;
}

// Single source of truth for the trip's total cost estimate — used both when
// the itinerary is first generated (Trip-at-a-Glance's "Est. total") and in
// the Estimated Budget Breakdown, so the two numbers can never drift apart
// the way a hotel[0]-only / first-4-activities-only shortcut previously did.
export function estimateTripBudget(
  input: {
    numDays: number;
    flights: FlightOption[];
    hotels: HotelOption[];
    activities: ActivityOption[];
  },
  preferences: TripPreferences,
  overrides: BudgetOverrides = {}
): BudgetEstimate {
  const { numDays, flights, hotels, activities } = input;
  const travelers = preferences.travelers ?? 1;
  const rooms = preferences.rooms ?? 1;
  const dailyFood = overrides.dailyFoodBudgetPerPerson ?? preferences.dailyFoodBudgetPerPerson ?? 80;

  // Flights list contains alternative options — only the first two represent
  // the outbound + return legs actually being budgeted.
  const baseCabin = normalizeCabinClass(flights[0]?.cabinClass);
  const targetCabin = overrides.cabinClass ?? baseCabin;
  const cabinRatio = CABIN_CLASS_MULTIPLIERS[targetCabin] / CABIN_CLASS_MULTIPLIERS[baseCabin];
  const flightCost = flights.slice(0, 2).reduce((s, f) => s + f.price, 0) * travelers * cabinRatio;

  const hotelNights = Math.max(numDays - 1, 1);
  const searchedAvgNightly = hotels.length
    ? hotels.reduce((s, h) => s + h.pricePerNight, 0) / hotels.length
    : 0;
  const avgNightly = overrides.lodgingTier ? LODGING_TIER_NIGHTLY[overrides.lodgingTier] : searchedAvgNightly;
  const hotelCost = avgNightly * hotelNights * rooms;

  const activityIntensity = overrides.activityIntensity ?? 1;
  const activityCost = activities.reduce((s, a) => s + a.price, 0) * travelers * activityIntensity;

  const foodCost = dailyFood * travelers * numDays;
  const transportCost = Math.round(numDays * 25 * travelers);
  const subtotal = flightCost + hotelCost + activityCost + foodCost + transportCost;
  const misc = Math.round(subtotal * 0.1);
  const total = subtotal + misc;

  const lines: BudgetLine[] = [
    { id: "flights",    label: "Flights",                    amount: flightCost,    note: `${travelers} traveler${travelers > 1 ? "s" : ""}, outbound + return · ${CABIN_CLASS_LABELS[targetCabin]}` },
    { id: "hotels",     label: "Hotels",                     amount: hotelCost,     note: `${hotelNights} night${hotelNights > 1 ? "s" : ""}, avg ${formatCurrency(avgNightly, preferences.preferredCurrency)}/night${rooms > 1 ? ` × ${rooms} rooms` : ""}` },
    { id: "activities", label: "Activities & Tours",         amount: activityCost,  note: `${activities.length} experience${activities.length !== 1 ? "s" : ""}${activityIntensity !== 1 ? ` · ${activityIntensity < 1 ? "lighter" : "packed"} pace` : ""}` },
    { id: "food",       label: "Food & Dining",               amount: foodCost,      note: `~$${dailyFood}/person/day × ${numDays} days` },
    { id: "transport",  label: "Local Transportation",       amount: transportCost, note: "rideshare, transit, taxis" },
    { id: "misc",       label: "Miscellaneous (10% buffer)", amount: misc,          note: "tips, souvenirs, incidentals" },
  ];

  return { lines, total, perPerson: Math.round(total / travelers), travelers };
}
