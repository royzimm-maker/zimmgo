import { formatCurrency } from "@/lib/utils";
import type { FlightOption, HotelOption, ActivityOption, TripPreferences } from "@/types/trip";

export interface BudgetLine {
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
  preferences: TripPreferences
): BudgetEstimate {
  const { numDays, flights, hotels, activities } = input;
  const travelers = preferences.travelers ?? 1;
  const rooms = preferences.rooms ?? 1;
  const dailyFood = preferences.dailyFoodBudgetPerPerson ?? 80;

  // Flights list contains alternative options — only the first two represent
  // the outbound + return legs actually being budgeted.
  const flightCost = flights.slice(0, 2).reduce((s, f) => s + f.price, 0) * travelers;
  const hotelNights = Math.max(numDays - 1, 1);
  const avgNightly = hotels.length
    ? hotels.reduce((s, h) => s + h.pricePerNight, 0) / hotels.length
    : 0;
  const hotelCost = avgNightly * hotelNights * rooms;
  const activityCost = activities.reduce((s, a) => s + a.price, 0) * travelers;
  const foodCost = dailyFood * travelers * numDays;
  const transportCost = Math.round(numDays * 25 * travelers);
  const subtotal = flightCost + hotelCost + activityCost + foodCost + transportCost;
  const misc = Math.round(subtotal * 0.1);
  const total = subtotal + misc;

  const lines: BudgetLine[] = [
    { label: "Flights",                    amount: flightCost,    note: `${travelers} traveler${travelers > 1 ? "s" : ""}, outbound + return` },
    { label: "Hotels",                     amount: hotelCost,     note: `${hotelNights} night${hotelNights > 1 ? "s" : ""}, avg ${formatCurrency(avgNightly)}/night${rooms > 1 ? ` × ${rooms} rooms` : ""}` },
    { label: "Activities & Tours",         amount: activityCost,  note: `${activities.length} experience${activities.length !== 1 ? "s" : ""}` },
    { label: "Food & Dining",              amount: foodCost,      note: `~$${dailyFood}/person/day × ${numDays} days` },
    { label: "Local Transportation",       amount: transportCost, note: "rideshare, transit, taxis" },
    { label: "Miscellaneous (10% buffer)", amount: misc,          note: "tips, souvenirs, incidentals" },
  ];

  return { lines, total, perPerson: Math.round(total / travelers), travelers };
}
