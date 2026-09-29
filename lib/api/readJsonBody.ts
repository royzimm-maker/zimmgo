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
