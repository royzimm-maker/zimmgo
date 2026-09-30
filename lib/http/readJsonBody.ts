import { NextRequest, NextResponse } from "next/server";

// Every route reads its JSON body through this, with a size cap suited to the
// route: AI routes forward fields into a prompt (an unbounded body is an
// unbounded token bill), and the rest do real work with it (searches, Word
// export). Reads the body as text and rejects anything over `maxBytes` (413)
// or unparseable (400) before doing anything with it.
export async function readJsonBody<T>(
  request: NextRequest,
  maxBytes: number
): Promise<{ ok: true; body: T } | { ok: false; response: NextResponse }> {
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
  }
  const raw = await request.text();
  if (raw.length > maxBytes) {
    return { ok: false, response: NextResponse.json({ error: "Request too large" }, { status: 413 }) };
  }
  try {
    return { ok: true, body: JSON.parse(raw) as T };
  } catch {
    return { ok: false, response: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }) };
  }
}

export function tooLong(field: string, max: number): NextResponse {
  return NextResponse.json({ error: `${field} is too long (max ${max} characters)` }, { status: 400 });
}

export function tooMany(field: string, max: number): NextResponse {
  return NextResponse.json({ error: `Too many ${field} (max ${max})` }, { status: 400 });
}

// Ceilings for the itinerary lists routes accept — well above any trip the
// app produces. They bound what one request can put into a prompt (smart
// pick, auto-plan) or into layout work (Word export).
export const ITINERARY_LIST_LIMITS = { days: 60, flights: 100, hotels: 60, activities: 150, restaurants: 150, candidates: 100 } as const;
type ListField = keyof typeof ITINERARY_LIST_LIMITS;

/** A 400 for the first of `fields` that's present but not a list or over its limit; null when all are fine. */
export function checkListLimits(body: object, fields: readonly ListField[]): NextResponse | null {
  for (const field of fields) {
    const list = (body as Record<string, unknown>)[field];
    if (list === undefined) continue;
    if (!Array.isArray(list)) return NextResponse.json({ error: `${field} must be a list` }, { status: 400 });
    if (list.length > ITINERARY_LIST_LIMITS[field]) return tooMany(field, ITINERARY_LIST_LIMITS[field]);
  }
  return null;
}
