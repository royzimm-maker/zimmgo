import { describe, it, expect } from "vitest";
import { getGroundTransportProvider } from "@/lib/data/groundTransportProviders";

describe("getGroundTransportProvider", () => {
  it("matches Greek island destinations to Ferryhopper", () => {
    const match = getGroundTransportProvider("Athens Santorini");
    expect(match?.provider).toBe("Ferryhopper");
    expect(match?.mode).toBe("ferry");
  });

  it("matches French destinations to SNCF Connect", () => {
    const match = getGroundTransportProvider("Paris Provence");
    expect(match?.provider).toBe("SNCF Connect");
    expect(match?.mode).toBe("train");
  });

  it("is case-insensitive", () => {
    expect(getGroundTransportProvider("BARCELONA ANDALUSIA MYKONOS")?.provider).toBe("Ferryhopper");
  });

  it("returns null for a destination with no matching regional operator", () => {
    expect(getGroundTransportProvider("Tokyo Kyoto")).toBeNull();
    expect(getGroundTransportProvider("")).toBeNull();
  });

  it("builds a booking URL from the template with from/to/date filled in", () => {
    const match = getGroundTransportProvider("Mykonos Santorini")!;
    const url = match.bookingUrlTemplate
      .replace("{from}", "Mykonos")
      .replace("{to}", "Santorini")
      .replace("{date}", "2026-09-10");
    expect(url).toBe("https://www.ferryhopper.com/en/search/Mykonos/Santorini/2026-09-10");
  });
});
