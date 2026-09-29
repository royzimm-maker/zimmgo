import { NextRequest, NextResponse } from "next/server";
import { getLocalDiscovery } from "@/lib/data/localDiscovery";

// Serves one destination's Local Discovery guide. The curated data covers
// every destination and lives only on the server, so the browser downloads
// just the guide for the trip it's showing rather than all of them.
//
// GET /api/local-discovery?destination=Italy+—+Rome+%26+Florence&city=Rome&city=Florence
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const destination = params.get("destination") ?? "";
  const cities = params.getAll("city");

  if (destination.length > 200 || cities.length > 30 || cities.some((c) => c.length > 100)) {
    return NextResponse.json({ error: "Request too large" }, { status: 400 });
  }

  const discovery = getLocalDiscovery(destination, cities.length || 1, cities);
  // Static data that only changes with a deploy — let the browser reuse it.
  // Private: the site is behind the gate, so shared caches shouldn't hold it.
  return NextResponse.json(discovery, { headers: { "Cache-Control": "private, max-age=3600" } });
}
