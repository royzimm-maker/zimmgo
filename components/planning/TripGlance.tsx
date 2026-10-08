"use client";

import { Plane, Hotel, Users, Calendar, MapPin, Check, Ship } from "lucide-react";
import { formatDate, formatCurrency, formatNightlyRate, googleFlightsUrlForPair, pairFlights } from "@/lib/utils";
import { itineraryCities } from "@/lib/location";
import { chosenHotelForCity, type HotelChoice } from "@/lib/planning/hotelChoice";
import { selectionsOf } from "@/lib/planning/selections";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}


export function TripGlance({ itinerary, preferences }: Props) {
  const { setSelectedFlight } = useTripStore();
  // The traveller's choices from this itinerary (lib/planning/selections.ts).
  const chosen = selectionsOf(itinerary);
  const { days, flights } = itinerary;
  const travelers = preferences.travelers ?? 1;
  const destination = preferences.destination?.displayName ?? "Your destination";
  const selectedFlightId = chosen.flight?.id;

  const firstDay = days[0];
  const lastDay  = days[days.length - 1];
  // The itinerary's last "day" is the final night's activities day, not the
  // checkout/return-flight date — for an exact-dates trip those are one
  // apart (e.g. a 7-night trip's last activity day is day 7, but the flight
  // home is the morning of day 8). Prefer the actual selected return date
  // so it matches what's shown in the flight cards below.
  const departureDate = preferences.dates?.startDate ?? firstDay?.date;
  const returnDate     = preferences.dates?.endDate   ?? lastDay?.date;

  const arrivalAirport = preferences.destination?.arrivalAirport ?? "";
  const pairs = pairFlights(flights, arrivalAirport);

  // One stay per city — the traveller's choice, or ZiGy's recommendation
  // where they haven't chosen (lib/planning/hotelChoice.ts) — rather than the
  // whole fetched pool, which would make the choice they made invisible.
  const cities = itineraryCities(itinerary, preferences.destination);
  const stays = cities
    .map((c) => chosenHotelForCity(c, itinerary, cities))
    .filter((s): s is HotelChoice => s !== null);
  const lodgingLabel = stays.every((s) => s.byTraveller)
    ? "Your Lodging"
    : stays.some((s) => s.byTraveller) ? "Lodging" : "Recommended Lodging";

  return (
    <div className="rounded-xl border border-brand-200 bg-white overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-600 to-brand-500 px-4 py-3 text-white">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-200 mb-0.5">Trip at a Glance</p>
        <h3 className="text-base font-bold">{destination}</h3>
      </div>

      {/* Key facts grid */}
      <div className="grid grid-cols-2 gap-0 border-b border-slate-100">
        <Fact icon={<Calendar size={13} />} label="Departure" value={departureDate ? formatDate(departureDate) : "—"} />
        <Fact icon={<Calendar size={13} />} label="Return" value={returnDate ? formatDate(returnDate) : "—"} border />
        <Fact icon={<Users size={13} />} label="Travelers" value={`${travelers} ${travelers === 1 ? "person" : "people"}`} top />
        <Fact icon={<MapPin size={13} />} label="Duration" value={`${days.length} day${days.length !== 1 ? "s" : ""}`} top border />
      </div>

      {/* Flights summary */}
      {pairs.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1">
              <Plane size={10} /> Flights
            </p>
            <span className="rounded bg-amber-50 border border-amber-200 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Round-trip · per person · estimates only
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {pairs.map(({ outbound, ret }) => {
              const roundtripPp = outbound.price + (ret?.price ?? 0);
              const isSelected = selectedFlightId === outbound.id;
              if (outbound.priceIsEstimate) {
                return (
                  <div key={outbound.id} className="rounded-lg border border-slate-200 bg-white p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-slate-800">{outbound.origin} → {outbound.destination}{ret ? ` → ${ret.destination}` : ""}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Typical fare — ZimmGo doesn&apos;t have live fares</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-sm font-bold text-slate-900">~{formatCurrency(roundtripPp, preferences.preferredCurrency)}</p>
                        <p className="text-[10px] text-slate-400">{ret ? "roundtrip" : "one way"}/pp est.</p>
                      </div>
                    </div>
                    <a
                      href={googleFlightsUrlForPair(outbound, ret)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-block text-[11px] font-semibold text-brand-600 hover:underline"
                    >
                      Search flights on Google Flights →
                    </a>
                  </div>
                );
              }
              return (
                <div
                  key={outbound.id}
                  className={`rounded-lg border p-2.5 transition-colors ${
                    isSelected
                      ? "border-brand-400 bg-brand-50"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-800">{outbound.airline}</p>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        {outbound.origin} → {outbound.destination}
                        {ret && ` · Return: ${ret.origin} → ${ret.destination}`}
                      </p>
                      {ret && (
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          Out: {formatCurrency(outbound.price, preferences.preferredCurrency)}/pp · Return: {formatCurrency(ret.price, preferences.preferredCurrency)}/pp
                        </p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-slate-900">{formatCurrency(roundtripPp, preferences.preferredCurrency)}</p>
                      <p className="text-[10px] text-slate-400">roundtrip/pp</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedFlight(isSelected ? null : outbound)}
                      className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors ${
                        isSelected
                          ? "bg-brand-600 text-white"
                          : "border border-brand-300 text-brand-700 hover:bg-brand-50"
                      }`}
                    >
                      {isSelected && <Check size={11} />}
                      {isSelected ? "Selected" : "Select this flight"}
                    </button>
                    <a
                      href={outbound.bookingUrl ?? `https://www.google.com/travel/flights`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[11px] text-brand-600 hover:underline"
                    >
                      Book →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hotels summary */}
      {stays.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Hotel size={10} />
            {lodgingLabel}
          </p>
          <div className="flex flex-col gap-1">
            {stays.map(({ hotel: h, byTraveller }) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium flex items-center gap-1">
                  {byTraveller && <Check size={11} className="text-sage-600 shrink-0" aria-label="Your choice" />}
                  {h.name}
                </span>
                <span className="text-slate-500">{h.location} · {formatNightlyRate(h, preferences.preferredCurrency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Ground transport summary — only for the handful of legs with a real
          regional operator (see lib/data/groundTransportProviders.ts), and
          only once the traveller has actually picked one; unlike flights/
          hotels there's no "recommended default" shown here, since this is
          an optional add-on most trips never touch. */}
      {Object.keys(chosen.transportByLeg ?? {}).length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Ship size={10} /> Getting There
          </p>
          <div className="flex flex-col gap-1">
            {Object.entries(chosen.transportByLeg ?? {}).map(([city, t]) => (
              <div key={city} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium flex items-center gap-1">
                  <Check size={11} className="text-sage-600 shrink-0" />
                  {t.provider} — {t.fromCity} → {t.toCity}
                </span>
                <span className="text-slate-500">{t.duration} · {formatCurrency(t.price, preferences.preferredCurrency)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

function Fact({
  icon, label, value, border = false, top = false,
}: {
  icon: React.ReactNode; label: string; value: string; border?: boolean; top?: boolean;
}) {
  return (
    <div className={`px-4 py-2.5 ${border ? "border-l border-slate-100" : ""} ${top ? "border-t border-slate-100" : ""}`}>
      <div className="flex items-center gap-1 text-[10px] text-slate-400 mb-0.5">{icon}{label}</div>
      <p className="text-xs font-semibold text-slate-800">{value}</p>
    </div>
  );
}
