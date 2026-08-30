import { describe, it, expect } from "vitest";
import { searchGroundTransport } from "@/lib/api/groundTransport";
import type { TripPreferences } from "@/types/trip";

const emptyPreferences: TripPreferences = {
  activities: [], activityRankings: {}, vibes: [], transportation: [],
};

describe("searchGroundTransport", () => {
  it("returns nothing when required params are missing", async () => {
    expect(await searchGroundTransport("", "Santorini", "2026-09-10", emptyPreferences)).toEqual([]);
    expect(await searchGroundTransport("Mykonos", "", "2026-09-10", emptyPreferences)).toEqual([]);
    expect(await searchGroundTransport("Mykonos", "Santorini", "", emptyPreferences)).toEqual([]);
  });

  it("returns nothing for a route with no matching regional operator", async () => {
    expect(await searchGroundTransport("Tokyo", "Kyoto", "2026-09-10", emptyPreferences)).toEqual([]);
  });

  it("returns ferry options for a Greek-island route", async () => {
    const options = await searchGroundTransport("Mykonos", "Santorini", "2026-09-10", emptyPreferences);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.mode).toBe("ferry");
      expect(o.provider).toBe("Ferryhopper");
      expect(o.fromCity).toBe("Mykonos");
      expect(o.toCity).toBe("Santorini");
      expect(o.currency).toBe("USD");
      expect(o.price).toBeGreaterThan(0);
      expect(o.bookingUrl).toContain("ferryhopper.com");
      expect(o.bookingUrl).toContain("Mykonos");
      expect(o.bookingUrl).toContain("Santorini");
      expect(o.bookingUrl).toContain("2026-09-10");
    }
    // Every option in the same result set gets a unique id.
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
  });

  it("returns train options for a French route", async () => {
    const options = await searchGroundTransport("Paris", "Provence", "2026-06-01", emptyPreferences);
    expect(options.length).toBeGreaterThan(0);
    for (const o of options) {
      expect(o.mode).toBe("train");
      expect(o.provider).toBe("SNCF Connect");
      expect(o.bookingUrl).toContain("sncf-connect.com");
    }
  });
});
