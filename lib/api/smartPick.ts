import type { SmartPickRequestBody, SmartPickResponse } from "@/types/smartPick";

export async function fetchSmartPick(body: SmartPickRequestBody): Promise<SmartPickResponse> {
  const res = await fetch("/api/itinerary/smart-pick", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
