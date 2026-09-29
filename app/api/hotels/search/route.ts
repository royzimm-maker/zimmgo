import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/api/errors";
import { searchHotels } from "@/lib/api/hotels";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as Parameters<typeof searchHotels>[0];
    const hotels = await searchHotels(body);
    return NextResponse.json(hotels);
  } catch (error: unknown) {
    return serverError("hotels/search", error);
  }
}
