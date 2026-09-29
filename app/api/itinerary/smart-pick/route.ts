import { NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rateLimit";
import { runSmartPick, SmartPickError } from "@/lib/ai/smartPick";
import { readJsonBody, tooMany } from "@/lib/api/readJsonBody";
import type { SmartPickRequestBody } from "@/types/smartPick";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "smart-pick", limit: 30, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<SmartPickRequestBody>(request, 400_000);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    // Every option in these lists is serialized into the prompt — cap them
    // well above what the app ever sends for a real trip.
    for (const [field, max] of [["hotels", 60], ["activities", 150], ["restaurants", 150], ["days", 60], ["candidates", 100]] as const) {
      const list = body[field];
      if (list !== undefined && (!Array.isArray(list) || list.length > max)) return tooMany(field, max);
    }

    return NextResponse.json(await runSmartPick(body));
  } catch (error: unknown) {
    if (error instanceof SmartPickError) return NextResponse.json({ error: error.message }, { status: error.status });
    console.error("[itinerary/smart-pick]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
