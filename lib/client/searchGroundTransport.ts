import type { TransportOption, TripPreferences } from "@/types/trip";

export async function fetchGroundTransport(
  fromCity: string,
  toCity: string,
  date: string,
  preferences: TripPreferences
): Promise<TransportOption[]> {
  const res = await fetch("/api/ground-transport/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ fromCity, toCity, date, preferences }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Ground transport search failed");
  const data = await res.json();
  return data.transport as TransportOption[];
}
