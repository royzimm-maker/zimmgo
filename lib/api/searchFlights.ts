import type { FlightOption, TripPreferences } from "@/types/trip";

export async function fetchFlightSearch(preferences: TripPreferences): Promise<FlightOption[]> {
  const res = await fetch("/api/itinerary/search-flights", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ preferences }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Flight search failed");
  const data = await res.json();
  return data.flights as FlightOption[];
}
