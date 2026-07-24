"use client";

import { useEffect, useState } from "react";
import { Star, ExternalLink, Check } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { HotelOption, LodgingPreference, LodgingStarRating, LodgingType } from "@/types/trip";

const TYPES: { id: LodgingType; label: string; icon: string; sublabel: string }[] = [
  { id: "hotel",    label: "Hotel",        icon: "🏨", sublabel: "Traditional hotel, full service" },
  { id: "airbnb",   label: "Airbnb / Apt", icon: "🏠", sublabel: "Home-like, flexible, local feel" },
  { id: "boutique", label: "Boutique",     icon: "🛎️", sublabel: "Design-led, intimate, unique" },
  { id: "resort",   label: "Resort",       icon: "🌴", sublabel: "All-inclusive, amenities-rich" },
];

const AMENITIES = [
  "Free breakfast", "Pool", "Gym", "Concierge", "Airport transfer",
  "Rooftop bar", "Spa", "City centre location", "Kitchen / kitchenette",
];

const HOTEL_TIER: Record<number, string> = {
  5: "The full five-star treatment",
  4: "Seriously comfortable, no drama",
  3: "Sleep well, spend the savings",
};

export function LodgingStep() {
  const { trip, setLodging, setSelectedHotel } = useTripStore();
  const existing = trip.preferences.lodging;
  const destination = trip.preferences.destination?.displayName ?? "";
  const budgetMax = trip.preferences.budgetRange === "under_500" ? 500
    : trip.preferences.budgetRange === "500_750" ? 750
    : trip.preferences.budgetRange === "750_1000" ? 1000
    : 1200;

  const [types,          setTypes         ] = useState<LodgingType[]>(existing?.types ?? []);
  const [otherTypeOpen,  setOtherTypeOpen ] = useState(false);
  const [otherTypeValue, setOtherTypeValue] = useState("");
  const [minStars,       setMinStars      ] = useState<LodgingStarRating>(existing?.minStars ?? 4);
  const [amenities,      setAmenities     ] = useState<string[]>(existing?.amenities ?? []);
  const [otherAmenity,   setOtherAmenity  ] = useState("");
  const [amenityOpen,    setAmenityOpen   ] = useState(false);

  const [hotels,          setHotels         ] = useState<HotelOption[]>([]);
  const [hotelsLoading,   setHotelsLoading  ] = useState(false);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    trip.preferences.selectedHotel?.id ?? null
  );

  async function fetchHotels(stars: number) {
    if (!destination) return;
    setHotelsLoading(true);
    try {
      const res = await fetch("/api/hotels/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          destination,
          min_stars: stars,
          max_price_per_night: budgetMax,
        }),
      });
      const data = await res.json() as HotelOption[];
      setHotels(Array.isArray(data) ? data : []);
    } catch {
      setHotels([]);
    } finally {
      setHotelsLoading(false);
    }
  }

  useEffect(() => { fetchHotels(minStars); }, []);

  function handleStarsChange(s: LodgingStarRating) {
    setMinStars(s);
    fetchHotels(s);
  }

  function toggleType(t: LodgingType) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  function handleContinue() {
    const allTypes = [...types];
    if (otherTypeOpen && otherTypeValue.trim()) allTypes.push(otherTypeValue.trim() as LodgingType);
    const allAmenities = [...amenities];
    if (amenityOpen && otherAmenity.trim()) allAmenities.push(otherAmenity.trim());

    const pref: LodgingPreference = { types: allTypes, minStars, amenities: allAmenities };
    setLodging(pref);

    const picked = hotels.find((h) => h.id === selectedHotelId) ?? null;
    setSelectedHotel(picked);
  }

  const hasType = types.length > 0 || (otherTypeOpen && !!otherTypeValue.trim());

  return (
    <StepShell
      stepId="lodging"
      onContinue={handleContinue}
      continueDisabled={!hasType}
      subtitle="We'll surface options that match your taste."
    >
      <div className="flex flex-col gap-6">
        {/* Type */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Accommodation type</p>
          <div className="grid grid-cols-2 gap-2">
            {TYPES.map((t) => (
              <SelectChip
                key={t.id}
                label={t.label}
                icon={t.icon}
                sublabel={t.sublabel}
                selected={types.includes(t.id)}
                onClick={() => toggleType(t.id)}
              />
            ))}
            <OtherInput
              selected={otherTypeOpen}
              value={otherTypeValue}
              onChange={setOtherTypeValue}
              onToggle={() => setOtherTypeOpen((v) => !v)}
              placeholder="e.g. Glamping, Ryokan, Hostel…"
            />
          </div>
        </div>

        {/* Star rating */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Minimum star rating</p>
          <div className="flex gap-2">
            {([3, 4, 5] as LodgingStarRating[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => handleStarsChange(s)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-4 py-2 text-sm font-medium transition-all",
                  minStars === s
                    ? "border-brand-500 bg-brand-50 text-brand-700"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {Array.from({ length: s }).map((_, i) => (
                  <Star key={i} size={12} className="fill-amber-400 text-amber-400" />
                ))}
              </button>
            ))}
          </div>
        </div>

        {/* Amenities */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">
            Must-have amenities <span className="text-slate-400 font-normal">(optional)</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {AMENITIES.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAmenity(a)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                  amenities.includes(a)
                    ? "border-brand-500 bg-brand-50 text-brand-600"
                    : "border-slate-200 text-slate-600 hover:border-slate-300"
                )}
              >
                {a}
              </button>
            ))}
            {!amenityOpen ? (
              <button
                type="button"
                onClick={() => setAmenityOpen(true)}
                className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-400 hover:border-brand-400 hover:text-brand-600 transition-all"
              >
                + Other
              </button>
            ) : (
              <div className="flex items-center gap-1.5">
                <input
                  autoFocus
                  type="text"
                  value={otherAmenity}
                  onChange={(e) => setOtherAmenity(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otherAmenity.trim()) setAmenityOpen(false);
                    if (e.key === "Escape") { setOtherAmenity(""); setAmenityOpen(false); }
                  }}
                  placeholder="e.g. EV charging…"
                  className="rounded-full border border-brand-400 px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 w-36"
                />
                <button
                  type="button"
                  onClick={() => { setOtherAmenity(""); setAmenityOpen(false); }}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >✕</button>
              </div>
            )}
          </div>
        </div>

        {/* Hotel picker */}
        {(hotelsLoading || hotels.length > 0) && (
          <div className="border-t border-slate-100 pt-5">
            <p className="mb-1 text-sm font-medium text-slate-700">Choose your stay</p>
            <p className="mb-3 text-xs text-slate-400">
              Lock in a hotel now or skip — you can always choose later.
            </p>

            {hotelsLoading ? (
              <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {hotels.map((h) => {
                  const selected = selectedHotelId === h.id;
                  const tierLabel = HOTEL_TIER[h.stars] ?? HOTEL_TIER[4];
                  return (
                    <div
                      key={h.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedHotelId((prev) => prev === h.id ? null : h.id)}
                      onKeyDown={(e) => e.key === "Enter" && setSelectedHotelId((prev) => prev === h.id ? null : h.id)}
                      className={cn(
                        "rounded-xl border p-3 cursor-pointer transition-all duration-150",
                        selected
                          ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/40"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={cn("font-semibold text-sm", selected ? "text-brand-700" : "text-slate-800")}>
                              {h.name}
                            </span>
                            <div className="flex">
                              {Array.from({ length: h.stars }).map((_, i) => (
                                <Star key={i} size={9} className="fill-amber-400 text-amber-400" />
                              ))}
                            </div>
                          </div>
                          <p className="text-[11px] text-slate-500 mt-0.5 italic">{tierLabel}</p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{h.location}</p>
                        </div>
                        <div className="text-right shrink-0 flex flex-col items-end gap-1">
                          <p className="font-bold text-slate-900 text-sm">
                            {formatCurrency(h.pricePerNight)}<span className="font-normal text-xs text-slate-400">/night</span>
                          </p>
                          <p className="text-xs text-sage-700 font-medium">{h.rating}/10</p>
                          {selected ? (
                            <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white">
                              <Check size={9} /> Your pick
                            </span>
                          ) : (
                            <a
                              href={h.bookingUrl}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline"
                            >
                              View <ExternalLink size={9} />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}
