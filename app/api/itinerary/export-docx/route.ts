import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/api/readJsonBody";
import { assembleItineraryDocxModel } from "@/lib/docx/assembleItineraryDocxModel";
import { renderItineraryDocx } from "@/lib/docx/renderItineraryDocx";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

// docx assembly is CPU-bound layout work, not an AI call, but still worth a
// generous ceiling — same reasoning as itinerary/generate's maxDuration.
export const maxDuration = 30;

// A real itinerary is tens of KB; these ceilings sit well above any trip the
// app produces and bound the layout work a single request can ask for.
const MAX_BODY_BYTES = 600_000;
const LIST_LIMITS = { days: 60, flights: 100, hotels: 60, activities: 150, restaurants: 150 } as const;

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

// Why the body can't be exported, or null if it can.
function invalidExport(itinerary: unknown, preferences: unknown): string | null {
  if (!isObject(itinerary) || !isObject(preferences)) return "An itinerary and preferences are required";
  for (const [field, max] of Object.entries(LIST_LIMITS)) {
    const list = itinerary[field];
    if (list === undefined && field === "restaurants") continue;
    if (!Array.isArray(list)) return `itinerary.${field} must be a list`;
    if (list.length > max) return `Too many ${field} (max ${max})`;
    if (!list.every(isObject)) return `itinerary.${field} contains an invalid entry`;
  }
  return null;
}

export async function POST(request: NextRequest) {
  // Tighter than the searches: each export is a burst of CPU work.
  const limited = await rateLimit(request, { bucket: "export-docx", limit: 10, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<{ itinerary?: unknown; preferences?: unknown }>(request, MAX_BODY_BYTES);
    if (!parsed.ok) return parsed.response;
    const { itinerary, preferences } = parsed.body ?? {};
    const problem = invalidExport(itinerary, preferences);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });

    const model = assembleItineraryDocxModel(itinerary as GeneratedItinerary, preferences as TripPreferences);
    const buffer = await renderItineraryDocx(model);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="itinerary.docx"',
      },
    });
  } catch (error: unknown) {
    return serverError("itinerary/export-docx", error);
  }
}
