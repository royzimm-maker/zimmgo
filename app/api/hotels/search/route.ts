import { NextRequest, NextResponse } from "next/server";
import { searchHotels } from "@/lib/api/hotels";
import { rateLimit } from "@/lib/rateLimit";
import { readJsonBody } from "@/lib/api/readJsonBody";
import { serverError } from "@/lib/api/errors";
import { parseWithSchema, type JsonSchema } from "@/lib/ai/toolInput";

type HotelSearchParams = Parameters<typeof searchHotels>[0];

// Deterministic (non-AI) hotel search, used by the Lodging step.
const BODY_SCHEMA: JsonSchema = {
  type: "object",
  properties: {
    destination: { type: "string", maxLength: 200 },
    check_in: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    check_out: { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    min_stars: { type: "integer", minimum: 1, maximum: 5 },
    types: { type: "array", items: { type: "string", maxLength: 50 }, maxItems: 10 },
    max_price_per_night: { type: "number", minimum: 0, maximum: 100_000 },
    amenities: { type: "array", items: { type: "string", maxLength: 50 }, maxItems: 20 },
    limit: { type: "integer", minimum: 1, maximum: 50 },
  },
  required: ["destination"],
};

export async function POST(request: NextRequest) {
  const limited = await rateLimit(request, { bucket: "search", limit: 60, windowMs: 5 * 60_000 });
  if (limited) return limited;

  try {
    const parsed = await readJsonBody<unknown>(request, 10_000);
    if (!parsed.ok) return parsed.response;
    const params = parseWithSchema<HotelSearchParams>(BODY_SCHEMA, parsed.body);
    if (!params || !params.destination) {
      return NextResponse.json({ error: "A destination is required" }, { status: 400 });
    }
    return NextResponse.json(await searchHotels(params));
  } catch (error: unknown) {
    return serverError("hotels/search", error);
  }
}
