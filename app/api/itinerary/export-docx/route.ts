import { NextRequest, NextResponse } from "next/server";
import { assembleItineraryDocxModel } from "@/lib/docx/assembleItineraryDocxModel";
import { renderItineraryDocx } from "@/lib/docx/renderItineraryDocx";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

// docx assembly is CPU-bound layout work, not an AI call, but still worth a
// generous ceiling — same reasoning as itinerary/generate's maxDuration.
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const { itinerary, preferences } = (await request.json()) as {
      itinerary: GeneratedItinerary;
      preferences: TripPreferences;
    };
    if (!itinerary || !preferences) {
      return NextResponse.json({ error: "Missing itinerary or preferences" }, { status: 400 });
    }

    const model = assembleItineraryDocxModel(itinerary, preferences);
    const buffer = await renderItineraryDocx(model);

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": 'attachment; filename="itinerary.docx"',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
