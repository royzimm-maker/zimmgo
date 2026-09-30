import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { rateLimit } from "@/lib/rateLimit";
import { runSmartPick, SmartPickError } from "@/lib/ai/smartPick";
import { checkListLimits, readJsonBody } from "@/lib/http/readJsonBody";
import type { SmartPickRequestBody } from "@/types/smartPick";

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "smart-pick", limit: 30, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<SmartPickRequestBody>(request, 400_000);
    if (!parsed.ok) return parsed.response;
    const body = parsed.body;

    // Every option in these lists is serialized into the prompt.
    const oversized = checkListLimits(body, ["hotels", "activities", "restaurants", "days", "candidates"]);
    if (oversized) return oversized;

    return NextResponse.json(await runSmartPick(body));
  } catch (error: unknown) {
    if (error instanceof SmartPickError) return NextResponse.json({ error: error.message }, { status: error.status });
    return serverError("itinerary/smart-pick", error);
  }
}
