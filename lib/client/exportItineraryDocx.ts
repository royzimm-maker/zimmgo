import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

export async function exportItineraryDocx(
  itinerary: GeneratedItinerary,
  preferences: TripPreferences
): Promise<void> {
  const res = await fetch("/api/itinerary/export-docx", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itinerary, preferences }),
  });
  if (!res.ok) throw new Error((await res.json()).error ?? "Export failed");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(preferences.destination?.displayName ?? "itinerary").replace(/[^a-z0-9]+/gi, "-")}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
