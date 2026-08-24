"use client";

import { Plane, Hotel, Users, Calendar, MapPin, Check } from "lucide-react";
import { formatDate, formatCurrency, pairFlights, fuzzyCityMatch } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}


export function TripGlance({ itinerary, preferences }: Props) {
  const { trip, setSelectedFlight } = useTripStore();
  const { days, flights, hotels } = itinerary;
  const travelers = preferences.travelers ?? 1;
  const destination = preferences.destination?.displayName ?? "Your destination";
  const selectedFlightId = trip.preferences.selectedFlight?.id;

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

  // Show the traveller's actual pick per city (made in the Hotels review
  // stage) rather than dumping the full raw fetched pool — otherwise a
  // multi-city trip shows several unselected-looking hotels per city and
  // the choice they already made is invisible here.
  const cities = preferences.destination?.cities?.filter(Boolean) ?? [];
  const displayHotels = (() => {
    if (preferences.selectedHotel) return [preferences.selectedHotel];
    const byCity = preferences.selectedHotelsByCity;
    if (byCity && Object.keys(byCity).length) {
      if (cities.length) return cities.map((c) => byCity[c]).filter((h): h is NonNullable<typeof h> => Boolean(h));
      return Object.values(byCity);
    }
    if (cities.length > 1) {
      return cities
        .map((c) => hotels.find((h) => fuzzyCityMatch(h.city ?? h.location, c)))
        .filter((h): h is NonNullable<typeof h> => Boolean(h));
    }
    return hotels.slice(0, 1);
  })();

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
      {displayHotels.length > 0 && (
        <div className="px-4 py-3 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2 flex items-center gap-1">
            <Hotel size={10} />
            {preferences.selectedHotel || preferences.selectedHotelsByCity ? "Your Lodging" : "Recommended Lodging"}
          </p>
          <div className="flex flex-col gap-1">
            {displayHotels.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-xs">
                <span className="text-slate-700 font-medium flex items-center gap-1">
                  {(preferences.selectedHotel || preferences.selectedHotelsByCity) && (
                    <Check size={11} className="text-sage-600 shrink-0" />
                  )}
                  {h.name}
                </span>
                <span className="text-slate-500">{h.location} · {formatCurrency(h.pricePerNight, preferences.preferredCurrency)}/night</span>
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
