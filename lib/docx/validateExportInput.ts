// What the Word export needs from a request body before any layout work.
// The body is client-supplied, so it's checked field by field against what
// the layout actually reads — a wrong type there would otherwise surface as
// a 500 ("name.normalize is not a function") instead of a clear 400.
import { ITINERARY_LIST_LIMITS } from "@/lib/http/readJsonBody";

type Loose = Record<string, unknown>;
// "?" marks a field that may be absent.
type FieldType = "string" | "number" | "boolean" | "string[]" | "string?" | "number?" | "boolean?" | "string[]?";
type Spec = Record<string, FieldType>;

const isObject = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);

function hasType(value: unknown, type: FieldType): boolean {
  const optional = type.endsWith("?");
  if (value === undefined || value === null) return optional;
  const base = optional ? type.slice(0, -1) : type;
  if (base === "string[]") return Array.isArray(value) && value.every((v) => typeof v === "string");
  return typeof value === base;
}

const HOTEL: Spec = { id: "string", name: "string", location: "string", city: "string?", pricePerNight: "number", highlights: "string[]" };

const ENTRY_SPECS: Record<"days" | "flights" | "hotels" | "activities" | "restaurants", Spec> = {
  days: {
    dayNumber: "number", date: "string?", location: "string?", theme: "string?", notes: "string?",
    morning: "string[]?", afternoon: "string[]?", evening: "string[]?",
  },
  flights: { id: "string", airline: "string", origin: "string", destination: "string", price: "number", cabinClass: "string?" },
  hotels: HOTEL,
  activities: { id: "string", name: "string", location: "string?", description: "string?", price: "number?", isLocalFavorite: "boolean?" },
  restaurants: {
    id: "string", name: "string", location: "string?", tier: "string?", cuisine: "string?", priceRange: "string?", mustOrder: "string?",
  },
};

function badField(obj: Loose, spec: Spec): string | null {
  return Object.entries(spec).find(([field, type]) => !hasType(obj[field], type))?.[0] ?? null;
}

/** Why the body can't be exported, or null if it can. */
export function invalidExport(itinerary: unknown, preferences: unknown): string | null {
  if (!isObject(itinerary) || !isObject(preferences)) return "An itinerary and preferences are required";

  for (const [field, spec] of Object.entries(ENTRY_SPECS) as [keyof typeof ENTRY_SPECS, Spec][]) {
    const list = itinerary[field];
    if (list === undefined && field === "restaurants") continue;
    if (!Array.isArray(list)) return `itinerary.${field} must be a list`;
    const max = ITINERARY_LIST_LIMITS[field];
    if (list.length > max) return `Too many ${field} (max ${max})`;
    for (const [i, entry] of list.entries()) {
      if (!isObject(entry)) return `itinerary.${field} contains an invalid entry`;
      const bad = badField(entry, spec);
      if (bad) return `itinerary.${field}[${i}].${bad} is missing or the wrong type`;
    }
  }

  // The traveller's choices and arrangement, when present.
  if (itinerary.selections !== undefined) {
    if (!isObject(itinerary.selections)) return "itinerary.selections is invalid";
    const { hotelsByCity, activityIds, restaurantIds } = itinerary.selections;
    if (hotelsByCity !== undefined && (!isObject(hotelsByCity) || !Object.values(hotelsByCity).every((h) => isObject(h) && !badField(h, HOTEL)))) {
      return "itinerary.selections.hotelsByCity is invalid";
    }
    if (!hasType(activityIds, "string[]?") || !hasType(restaurantIds, "string[]?")) return "itinerary.selections is invalid";
  }
  if (itinerary.finalizedPlan !== undefined) {
    const plan = itinerary.finalizedPlan;
    if (!isObject(plan) || !isObject(plan.dayCards) || !Object.values(plan.dayCards).every((ids) => hasType(ids, "string[]"))) {
      return "itinerary.finalizedPlan is invalid";
    }
  }

  const destination = preferences.destination;
  if (destination !== undefined && (!isObject(destination) || badField(destination, { cities: "string[]?", displayName: "string?" }))) {
    return "preferences.destination is invalid";
  }
  if (!hasType(preferences.travelers, "number?")) return "preferences.travelers must be a number";
  return null;
}
