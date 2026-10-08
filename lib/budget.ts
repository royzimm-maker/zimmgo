import { formatCurrency, pairFlights } from "@/lib/utils";
import { buildTripPlan, type TripPlan } from "@/lib/itinerary/tripPlan";
import { selectionsOf } from "@/lib/planning/selections";
import { hasArrangedLodging } from "@/lib/planning/route";
import type { ActivityOption, BudgetRange, GeneratedItinerary, TripPreferences } from "@/types/trip";

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
  /** The cabin of the flights being priced, before any "what if" cabin change. */
  baseCabin: CabinClass;
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

// The trip's cost estimate, priced from what the traveller is actually
// doing: the chosen flight pair, each night at that city's chosen stay, and
// the activities they picked. Where they haven't chosen yet, ZimmGo's
// recommendation stands in (the first flight pair, ZimmGo's hotel per city,
// every suggested activity). Computed on demand — never stored — so it
// follows the traveller's picks. Used by Trip-at-a-Glance's "Est. total" and
// the Estimated Budget Breakdown, so the two can't disagree.
export function estimateTripBudget(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences,
  overrides: BudgetOverrides = {}
): BudgetEstimate {
  const numDays = itinerary.days.length;
  const travelers = preferences.travelers ?? 1;
  const rooms = preferences.rooms ?? 1;
  const dailyFood = overrides.dailyFoodBudgetPerPerson ?? preferences.dailyFoodBudgetPerPerson ?? 80;
  const chosen = selectionsOf(itinerary);
  const plan = buildTripPlan(itinerary, preferences);

  const pairs = pairFlights(itinerary.flights, preferences.destination?.arrivalAirport ?? "");
  const pair = pairs.find((p) => p.outbound.id === chosen.flight?.id) ?? pairs[0];
  const baseCabin = normalizeCabinClass(pair?.outbound.cabinClass);
  const targetCabin = overrides.cabinClass ?? baseCabin;
  const cabinRatio = CABIN_CLASS_MULTIPLIERS[targetCabin] / CABIN_CLASS_MULTIPLIERS[baseCabin];
  const flightCost = pair ? (pair.outbound.price + (pair.ret?.price ?? 0)) * travelers * cabinRatio : 0;

  // One night per day except the last, each at that day's city's stay —
  // except where the traveller's lodging is already arranged (a villa).
  const offeredAvg = itinerary.hotels.length ? itinerary.hotels.reduce((s, h) => s + h.pricePerNight, 0) / itinerary.hotels.length : 0;
  const nightDays = plan.days.length > 1 ? plan.days.slice(0, -1) : plan.days;
  const paidDays = nightDays.filter((d) => !hasArrangedLodging(d.city, preferences));
  const nights = paidDays.map((d) => d.stay?.hotel.pricePerNight ?? offeredAvg);
  const hotelNights = nights.length;
  const avgNightly = !hotelNights ? 0 : overrides.lodgingTier ? LODGING_TIER_NIGHTLY[overrides.lodgingTier] : nights.reduce((s, n) => s + n, 0) / hotelNights;
  const hotelCost = avgNightly * hotelNights * rooms;
  const arrangedNote = paidDays.length < nightDays.length ? " · not counting your own lodging" : "";

  const activities = plannedActivities(itinerary, plan);
  const activityIntensity = overrides.activityIntensity ?? 1;
  const activityCost = activities.list.reduce((s, a) => s + a.price, 0) * travelers * activityIntensity;

  const foodCost = dailyFood * travelers * numDays;
  const transportCost = Math.round(numDays * 25 * travelers);
  const subtotal = flightCost + hotelCost + activityCost + foodCost + transportCost;
  const misc = Math.round(subtotal * 0.1);
  const total = subtotal + misc;

  const n = activities.list.length;
  const lines: BudgetLine[] = [
    { id: "flights",    label: "Flights",                    amount: flightCost,    note: `${travelers} traveler${travelers > 1 ? "s" : ""}, outbound + return · ${CABIN_CLASS_LABELS[targetCabin]}${pair?.outbound.priceIsEstimate ? " · typical fare" : ""}` },
    { id: "hotels",     label: "Hotels",                     amount: hotelCost,     note: hotelNights ? `${hotelNights} night${hotelNights > 1 ? "s" : ""}, avg ${formatCurrency(avgNightly, preferences.preferredCurrency)}/night${rooms > 1 ? ` × ${rooms} rooms` : ""}${!overrides.lodgingTier && plan.days.some((d) => d.stay?.hotel.priceIsEstimate) ? " · estimated rates" : ""}${arrangedNote}` : "your own lodging" },
    { id: "activities", label: "Activities & Tours",         amount: activityCost,  note: `${n} ${activities.picked ? "" : "suggested "}experience${n !== 1 ? "s" : ""}${activityIntensity !== 1 ? ` · ${activityIntensity < 1 ? "lighter" : "packed"} pace` : ""}${activities.list.some((x) => x.priceIsEstimate) ? " · some entry fees estimated" : ""}` },
    { id: "food",       label: "Food & Dining",               amount: foodCost,      note: `~$${dailyFood}/person/day × ${numDays} days` },
    { id: "transport",  label: "Local Transportation",       amount: transportCost, note: "rideshare, transit, taxis" },
    { id: "misc",       label: "Miscellaneous (10% buffer)", amount: misc,          note: "tips, souvenirs, incidentals" },
  ];

  return { lines, total, perPerson: Math.round(total / travelers), travelers, baseCabin };
}

// The activities the traveller is doing: those on their arranged days, else
// the ones they picked, else (nothing chosen yet) everything ZimmGo suggested.
function plannedActivities(itinerary: GeneratedItinerary, plan: TripPlan): { list: ActivityOption[]; picked: boolean } {
  if (itinerary.finalizedPlan) {
    const list = plan.days.flatMap((d) => d.items.flatMap((i) => (i.kind === "activity" ? [i.activity] : [])));
    return { list, picked: true };
  }
  const ids = selectionsOf(itinerary).activityIds;
  if (ids?.length) return { list: itinerary.activities.filter((a) => ids.includes(a.id)), picked: true };
  return { list: itinerary.activities, picked: false };
}
