"use client";

import { useEffect, useMemo, useState } from "react";
import { Star, ExternalLink, Check, Sparkles } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { ChooseModePrompt } from "@/components/planning/ChooseModePrompt";
import { ModeToggleBanner } from "@/components/planning/ModeToggleBanner";
import { useSmartPick } from "@/lib/hooks/useSmartPick";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { resolveBudget, DEFAULT_BUDGET_MAX } from "@/types/trip";
import { REVIEW_SOURCES, applyReviewSourcePref } from "@/lib/data/reviewSources";
import type { HotelOption, LodgingPreference, LodgingStarRating, LodgingType, ReviewSource } from "@/types/trip";

const TYPES: { id: LodgingType; label: string; icon: string; sublabel: string }[] = [
  { id: "hotel",    label: "Hotel",        icon: "🏨", sublabel: "Traditional hotel, full service" },
  { id: "airbnb",   label: "AirBnB / Apt", icon: "🏠", sublabel: "Home-like, flexible, local feel" },
  { id: "boutique", label: "Boutique",     icon: "🛎️", sublabel: "Design-led, intimate, unique" },
  { id: "resort",   label: "Resort",       icon: "🌴", sublabel: "All-inclusive, amenities-rich" },
];

const AMENITIES = [
  "Free breakfast", "Pool", "Gym", "Concierge", "Airport transfer",
  "Rooftop bar", "Spa", "City centre location", "Kitchen / kitchenette",
  "High walkability",
];

const HOTEL_TIER: Record<number, string> = {
  5: "The full five-star treatment",
  4: "Seriously comfortable, no drama",
  3: "Sleep well, spend the savings",
};

export function LodgingStep() {
  const { trip, setLodging, setSelectedHotel, setReviewSourcePref } = useTripStore();
  const existing = trip.preferences.lodging;
  const [mode, setMode] = useState<"prompt" | "manual">(() => (existing ? "manual" : "prompt"));
  const { picking, pickSummary, run: runSmartPick } = useSmartPick();
  // Use only the primary city for hotel search — avoids "Cultural district, Italy — Rome, & Amalfi Coast" strings
  const destination = trip.preferences.destination?.cities?.[0]
    ?? trip.preferences.destination?.displayName ?? "";
  const budgetMax = resolveBudget(trip.preferences)?.max ?? DEFAULT_BUDGET_MAX;

  const [types,          setTypes         ] = useState<LodgingType[]>(existing?.types ?? []);
  const [otherTypeOpen,  setOtherTypeOpen ] = useState(false);
  const [otherTypeValue, setOtherTypeValue] = useState("");
  const [minStars,       setMinStars      ] = useState<LodgingStarRating>(existing?.minStars ?? 4);
  const [amenities,      setAmenities     ] = useState<string[]>(existing?.amenities ?? []);
  const [otherAmenity,   setOtherAmenity  ] = useState("");
  const [amenityOpen,    setAmenityOpen   ] = useState(false);

  const existingReviewPref = trip.preferences.reviewSourcePref;
  const [reviewMode,   setReviewMode  ] = useState<"single" | "cross_reference">(existingReviewPref?.mode ?? "cross_reference");
  const [reviewSource, setReviewSource] = useState<ReviewSource | null>(existingReviewPref?.source ?? null);

  const [hotels,          setHotels         ] = useState<HotelOption[]>([]);
  const [hotelsLoading,   setHotelsLoading  ] = useState(false);
  const [visibleHotelCount, setVisibleHotelCount] = useState(3);
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
          types: types.length > 0 ? types : undefined,
        }),
      });
      const data = await res.json() as HotelOption[];
      setHotels(Array.isArray(data) ? data : []);
      setVisibleHotelCount(3);
    } catch {
      setHotels([]);
    } finally {
      setHotelsLoading(false);
    }
  }

  // Only fetch hotels once the user has chosen an accommodation type — don't pre-load
  useEffect(() => {
    const onlyAirbnb = types.length > 0 && types.every((t) => t === "airbnb") && !otherTypeOpen;
    if (types.length > 0 && !onlyAirbnb) fetchHotels(minStars);
  }, [types.join(","), otherTypeOpen]);

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

  async function handleZigyPick() {
    const candidates = [
      ...TYPES.map((t) => ({ id: `type:${t.id}`, label: `Lodging type: ${t.label}` })),
      ...([3, 4, 5] as LodgingStarRating[]).map((s) => ({ id: `stars:${s}`, label: `${s}-star minimum` })),
      ...AMENITIES.map((a) => ({ id: `amenity:${a}`, label: `Amenity: ${a}` })),
    ];
    const picks = await runSmartPick({ kind: "lodging", preferences: trip.preferences, candidates });

    const stripPrefix = (id: string, prefix: string) =>
      id.startsWith(prefix) ? id.slice(prefix.length) : null;

    const pickedTypes = picks
      .map((p) => stripPrefix(p.id, "type:") as LodgingType | null)
      .filter((t): t is LodgingType => t !== null && TYPES.some((x) => x.id === t));
    const pickedStarsValue = picks
      .map((p) => stripPrefix(p.id, "stars:"))
      .find((s): s is string => s !== null);
    const pickedAmenities = picks
      .map((p) => stripPrefix(p.id, "amenity:"))
      .filter((a): a is string => a !== null && AMENITIES.includes(a));

    if (pickedTypes.length) setTypes(pickedTypes);
    if (pickedStarsValue) setMinStars(Number(pickedStarsValue) as LodgingStarRating);
    setAmenities(pickedAmenities);
    setMode("manual");
  }

  function handleContinue() {
    const allTypes = [...types];
    if (otherTypeOpen && otherTypeValue.trim()) allTypes.push(otherTypeValue.trim() as LodgingType);
    const allAmenities = [...amenities];
    if (amenityOpen && otherAmenity.trim()) allAmenities.push(otherAmenity.trim());

    const pref: LodgingPreference = { types: allTypes, minStars, amenities: allAmenities };
    setLodging(pref);

    setReviewSourcePref(
      reviewMode === "single" && reviewSource
        ? { mode: "single", source: reviewSource }
        : { mode: "cross_reference" }
    );

    const picked = displayHotels.find((h) => h.id === selectedHotelId) ?? null;
    setSelectedHotel(picked);
  }

  // Live preview of the rating source the user is currently choosing, so the hotel
  // cards below reflect it immediately instead of only after generation. Only
  // the currently-visible slice is shaped — visibleHotelCount only ever grows
  // (via "show more"), so a hotel visible now stays visible, and there's no
  // point jittering ratings for hotels nobody's scrolled to yet.
  const displayHotels = useMemo(
    () =>
      applyReviewSourcePref(
        hotels.slice(0, visibleHotelCount),
        reviewMode === "single" && reviewSource
          ? { mode: "single", source: reviewSource }
          : { mode: "cross_reference" }
      ),
    [hotels, visibleHotelCount, reviewMode, reviewSource]
  );

  const hasType = types.length > 0 || (otherTypeOpen && !!otherTypeValue.trim());
  // Only show hotel picker if accommodation type includes bookable hotel options
  const airbnbOnly = types.length > 0 && types.every((t) => t === "airbnb") && !otherTypeOpen;

  if (mode === "prompt") {
    return (
      <StepShell
        stepId="lodging"
        continueLabel="I'll pick myself"
        onContinue={() => { setMode("manual"); return false; }}
        subtitle="How do you want to choose your lodging preferences?"
      >
        <ChooseModePrompt
          manualLabel="I'll pick myself"
          manualDescription="Choose the accommodation type, star rating, and amenities that matter to you."
          zigyDescription="ZiGy picks a type, star tier, and a few amenities that fit your destination and budget — you can still adjust before continuing."
          onManual={() => setMode("manual")}
          onZigy={handleZigyPick}
          loading={picking}
        />
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="lodging"
      onContinue={handleContinue}
      continueDisabled={!hasType}
      subtitle="We'll surface options that match your taste."
    >
      <ModeToggleBanner
        label="Lodging preferences for you to choose from — or let ZiGy pick."
        onZigy={handleZigyPick}
        loading={picking}
      />
      <div className="flex flex-col gap-6">
        {pickSummary && (
          <p className="text-xs text-brand-600 bg-brand-50 rounded-lg px-3 py-2">
            <Sparkles size={11} className="inline mr-1" />
            {pickSummary}
          </p>
        )}
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

        {/* Review source preference — applies to hotels, restaurants, and activities */}
        <div className="border-t border-slate-100 pt-5">
          <p className="mb-1 text-sm font-medium text-slate-700">Ratings & reviews</p>
          <p className="mb-2.5 text-xs text-slate-400">
            How should we source ratings for hotels, restaurants, and activities?
          </p>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={() => setReviewMode("cross_reference")}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all",
                reviewMode === "cross_reference"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              Cross-reference multiple sources
              <span className="block text-xs font-normal text-slate-400 mt-0.5">
                Average across Google Reviews, TripAdvisor & Booking.com
              </span>
            </button>
            <button
              type="button"
              onClick={() => setReviewMode("single")}
              className={cn(
                "rounded-lg border px-3 py-2 text-left text-sm font-medium transition-all",
                reviewMode === "single"
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              Use a single source
              <span className="block text-xs font-normal text-slate-400 mt-0.5">Pick the one you trust most</span>
            </button>
            {reviewMode === "single" && (
              <div className="flex flex-wrap gap-2 pl-1 pt-1">
                {REVIEW_SOURCES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setReviewSource(src)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-all",
                      reviewSource === src
                        ? "border-brand-500 bg-brand-50 text-brand-600"
                        : "border-slate-200 text-slate-600 hover:border-slate-300"
                    )}
                  >
                    {src}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* AirBnB note — shown instead of hotel cards */}
        {airbnbOnly && (
          <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
            <p className="font-medium">AirBnB options will be surfaced in your itinerary.</p>
            <p className="text-xs text-brand-500 mt-0.5">We'll recommend apartments and local stays that match your destination and dates.</p>
          </div>
        )}

        {/* Hotel picker */}
        {!airbnbOnly && hasType && (
          <div className="border-t border-slate-100 pt-5">
            <p className="mb-1 text-sm font-medium text-slate-700">Choose your stay</p>
            <p className="mb-3 text-xs text-slate-400">
              Lock in a hotel now or skip — you can always choose later.
            </p>

            {hotelsLoading ? (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
                ))}
              </div>
            ) : hotels.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
                <p className="text-sm text-slate-500">No hotels matched this combination.</p>
                <p className="text-xs text-slate-400 mt-1">
                  Try a lower minimum star rating, a different accommodation type, or a higher nightly budget.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {displayHotels.map((h) => {
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
                        "flex flex-col rounded-xl border p-3 cursor-pointer transition-all duration-150",
                        selected
                          ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/40"
                          : "border-slate-200 hover:border-slate-300 bg-white"
                      )}
                    >
                      <div className="flex items-center gap-1">
                        {Array.from({ length: h.stars }).map((_, i) => (
                          <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                      <span className={cn("mt-1 font-semibold text-sm leading-tight", selected ? "text-brand-700" : "text-slate-800")}>
                        {h.name}
                      </span>
                      <p className="text-[11px] text-slate-500 mt-0.5 italic">{tierLabel}</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">{h.location}</p>

                      <div className="flex-1" />

                      <div className="mt-3 flex items-end justify-between gap-2 pt-2 border-t border-slate-100">
                        <div>
                          <p className="font-bold text-slate-900 text-sm">
                            {formatCurrency(h.pricePerNight)}<span className="font-normal text-xs text-slate-400">/night</span>
                          </p>
                          <p className="text-xs text-sage-700 font-medium">{h.rating}/10</p>
                          {h.ratingSource && (
                            <p className="text-[9px] text-slate-400">{h.ratingSource}</p>
                          )}
                        </div>
                        {selected ? (
                          <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                            <Check size={9} /> Your pick
                          </span>
                        ) : (
                          <a
                            href={h.bookingUrl}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0 flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline"
                          >
                            View <ExternalLink size={9} />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {!hotelsLoading && hotels.length > visibleHotelCount && (
              <button
                type="button"
                onClick={() => setVisibleHotelCount((c) => c + 3)}
                className="mt-3 w-full rounded-lg border border-dashed border-slate-300 px-4 py-2 text-xs font-medium text-slate-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
              >
                Show more options ({hotels.length - visibleHotelCount} more)
              </button>
            )}
          </div>
        )}
      </div>
    </StepShell>
  );
}
