"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Star, Sparkles, AlertCircle } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { ChooseModePrompt, type ModeChoice } from "@/components/planning/ChooseModePrompt";
import { ModeToggleBanner } from "@/components/planning/ModeToggleBanner";
import { LodgingHotelCard } from "@/components/planning/LodgingHotelCard";
import { useSmartPick } from "@/lib/hooks/useSmartPick";
import { fetchSmartPick } from "@/lib/client/smartPick";
import { fetchHotelSearch } from "@/lib/client/searchHotels";
import { assembleLodging, lodgingFromPicks, lodgingPickCandidates, type LodgingDraft } from "@/lib/planning/lodgingPicks";
import { chooseHotel, isAirbnbOnly } from "@/lib/planning/cityPicks";
import { cn, scrollStepToTop } from "@/lib/utils";
import { itineraryCities } from "@/lib/location";
import { useTripStore } from "@/lib/store/tripStore";
import { resolveBudget, DEFAULT_BUDGET_MAX } from "@/types/trip";
import { REVIEW_SOURCES, applyReviewSourcePref } from "@/lib/data/reviewSources";
import type { HotelOption, LodgingStarRating, LodgingType, ReviewSource } from "@/types/trip";

const TYPES: { id: LodgingType; label: string; icon: string; sublabel: string }[] = [
  { id: "hotel",    label: "Hotel",        icon: "🏨", sublabel: "Traditional hotel, full service" },
  { id: "airbnb",   label: "AirBnB / Apt", icon: "🏠", sublabel: "Home-like, flexible, local feel" },
  { id: "boutique", label: "Boutique",     icon: "🛎️", sublabel: "Design-led, intimate, unique" },
  { id: "resort",   label: "Resort",       icon: "🌴", sublabel: "All-inclusive, amenities-rich" },
  { id: "hostel",   label: "Hostel",       icon: "🎒", sublabel: "Budget-friendly, social, shared or private rooms" },
];

const AMENITIES = [
  "Free breakfast", "Pool", "Gym", "Concierge", "Airport transfer",
  "Rooftop bar", "Spa", "City center location", "Kitchen / kitchenette",
  "High walkability",
];

export function LodgingStep() {
  const { trip, setLodging, setLodgingPick, setReviewSourcePref, setAutoPickHotels } = useTripStore();
  const existing = trip.preferences.lodging;
  // "zigy_review" is a transient state shown right after picking "Let ZiGy
  // choose for me" on the initial prompt — a focused summary of the pick
  // instead of dropping straight into the full editable form, which read as
  // "the decision is still up to you" even though ZiGy had already decided.
  const [mode, setMode] = useState<"prompt" | "manual" | "zigy_review">(() => (existing ? "manual" : "prompt"));
  const [showMoreHotels, setShowMoreHotels] = useState(false);
  const [modeChoice, setModeChoice] = useState<ModeChoice | null>(null);
  const { picking, pickSummary, error: pickError, run: runSmartPick } = useSmartPick();
  // This step picks the primary city's hotel, before there's an itinerary.
  // Search by that city alone — avoids "Cultural district, Italy — Rome, &
  // Amalfi Coast" strings. The pick is saved as a preference (lodgingPick);
  // the itinerary's choice for this city starts from it.
  const destination = itineraryCities(null, trip.preferences.destination)[0] ?? "";
  const savedPick = trip.preferences.lodgingPick;
  const budgetMax = resolveBudget(trip.preferences)?.max ?? DEFAULT_BUDGET_MAX;

  const [types,          setTypes         ] = useState<LodgingType[]>(existing?.types ?? []);
  const [otherTypeOpen,  setOtherTypeOpen ] = useState(false);
  const [otherTypeValue, setOtherTypeValue] = useState("");
  const [minStars,       setMinStars      ] = useState<LodgingStarRating>(existing?.minStars ?? 4);
  const [amenities,      setAmenities     ] = useState<string[]>(existing?.amenities ?? []);
  const [otherAmenity,   setOtherAmenity  ] = useState("");
  const [amenityOpen,    setAmenityOpen   ] = useState(false);

  // This step keeps its own draft state and only writes back to the store on
  // Continue — so a chat-driven edit (ZiGy applying "find me resorts instead"
  // while the user is sitting on this step) wouldn't otherwise be visible
  // until they navigated away and back. `existing` only changes here when
  // something outside this component calls setLodging, so re-sync the draft
  // whenever it does.
  useEffect(() => {
    if (!existing) return;
    setTypes(existing.types);
    setMinStars(existing.minStars);
    setAmenities(existing.amenities);
  }, [existing]);

  const existingReviewPref = trip.preferences.reviewSourcePref;
  const [reviewMode,   setReviewMode  ] = useState<"single" | "cross_reference">(existingReviewPref?.mode ?? "cross_reference");
  const [reviewSource, setReviewSource] = useState<ReviewSource | null>(existingReviewPref?.source ?? null);

  const [hotels,          setHotels         ] = useState<HotelOption[]>([]);
  const [hotelsLoading,   setHotelsLoading  ] = useState(false);
  const [visibleHotelCount, setVisibleHotelCount] = useState(3);
  const [selectedHotelId, setSelectedHotelId] = useState<string | null>(
    savedPick?.id ?? null
  );
  // Separate from `picking`/`pickSummary` (which cover the type/stars/amenity
  // filters) — this covers the follow-up step of actually choosing one of the
  // resulting hotels, so "let ZiGy pick" doesn't just narrow the filters and
  // leave "Choose your stay" below sitting there unresolved.
  const [pickingHotel,   setPickingHotel  ] = useState(false);
  const [hotelPickReason, setHotelPickReason] = useState<string | null>(null);
  const [hotelPickError,  setHotelPickError ] = useState<string | null>(null);

  // The form as it stands, and the lodging it saves as (lib/planning/lodgingPicks.ts).
  const draft: LodgingDraft = { types, minStars, amenities, otherTypeOpen, otherTypeValue, amenityOpen, otherAmenity };
  // A custom type typed into "Other…" (e.g. "hostel") is searched for too,
  // not only saved — picking only a custom type must still fetch hotels.
  const effectiveTypes = assembleLodging(draft).types;

  async function fetchHotels(stars: number, typesOverride?: LodgingType[]): Promise<HotelOption[]> {
    if (!destination) return [];
    setHotelsLoading(true);
    try {
      const dates = trip.preferences.dates;
      const stay = dates?.type === "exact" ? { checkIn: dates.startDate, checkOut: dates.endDate } : {};
      const list = await fetchHotelSearch({ destination, minStars: stars, maxPricePerNight: budgetMax, types: typesOverride ?? effectiveTypes, ...stay });
      setHotels(list);
      setVisibleHotelCount(3);
      return list;
    } catch {
      setHotels([]);
      return [];
    } finally {
      setHotelsLoading(false);
    }
  }

  // Only fetch hotels once the user has chosen an accommodation type — don't pre-load
  useEffect(() => {
    // handleZigyPick's own setTypes/setMinStars calls land in the same batch
    // as setPickingHotel(true), so this effect re-fires for the exact same
    // type/star change it's already fetching for. Since the mock search
    // hands out a fresh random id to every hotel on every call, whichever
    // fetch's response lands last "wins" and can silently orphan the hotel
    // ZiGy just picked — pickingHotel skips the redundant duplicate here so
    // there's only ever one fetch in flight for a ZiGy-driven change.
    if (pickingHotel) return;
    const onlyAirbnb = isAirbnbOnly(effectiveTypes);
    if (effectiveTypes.length > 0 && !onlyAirbnb) fetchHotels(minStars);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effectiveTypes.join(",")]);

  // Write every change straight to the store instead of only on Continue —
  // otherwise a manual pick made here is invisible to chat (which only reads
  // the store) and gets silently clobbered the moment chat applies its own
  // update, since that overwrites the store and this step's own sync-from-
  // store effect above then overwrites the local draft to match.
  function syncLodging(overrides: Partial<LodgingDraft> = {}) {
    setLodging(assembleLodging({ ...draft, ...overrides }));
  }

  function handleStarsChange(s: LodgingStarRating) {
    setMinStars(s);
    fetchHotels(s);
    syncLodging({ minStars: s });
  }

  function toggleType(t: LodgingType) {
    const next = types.includes(t) ? types.filter((x) => x !== t) : [...types, t];
    setTypes(next);
    syncLodging({ types: next });
  }

  function toggleAmenity(a: string) {
    const next = amenities.includes(a) ? amenities.filter((x) => x !== a) : [...amenities, a];
    setAmenities(next);
    syncLodging({ amenities: next });
  }

  function handleOtherTypeChange(v: string) {
    setOtherTypeValue(v);
    syncLodging({ otherTypeValue: v });
  }
  function handleOtherTypeToggle() {
    const next = !otherTypeOpen;
    setOtherTypeOpen(next);
    syncLodging({ otherTypeOpen: next });
  }
  function handleOtherAmenityChange(v: string) {
    setOtherAmenity(v);
    syncLodging({ otherAmenity: v });
  }
  function handleAmenityOpen() {
    setAmenityOpen(true);
    syncLodging({ amenityOpen: true });
  }
  function handleAmenityClear() {
    setOtherAmenity("");
    setAmenityOpen(false);
    syncLodging({ otherAmenity: "", amenityOpen: false });
  }

  async function handleZigyPick() {
    // Marks the traveller's intent for every city, not just the one this
    // step itself searches — the itinerary review wizard's per-city Hotels
    // stage reads this to auto-run the same smart pick for the other
    // stops instead of leaving each one on a blank picker.
    setAutoPickHotels(true);
    const picks = await runSmartPick({ kind: "lodging", preferences: trip.preferences, candidates: lodgingPickCandidates(TYPES, AMENITIES) });
    const next = lodgingFromPicks(picks, { types: TYPES.map((t) => t.id), amenities: AMENITIES }, { types, minStars });
    const nextTypes = next.types;
    const nextStars = next.minStars;
    setTypes(nextTypes);
    setMinStars(nextStars);
    setAmenities(next.amenities);
    syncLodging({ types: nextTypes, minStars: nextStars, amenities: next.amenities });

    // Also choose a specific hotel matching those filters — otherwise this
    // only narrows "Choose your stay" below and still leaves it unresolved.
    if (!isAirbnbOnly(nextTypes) && destination) {
      setPickingHotel(true);
      setHotelPickError(null);
      try {
        const fetchedHotels = await fetchHotels(nextStars, nextTypes);
        if (fetchedHotels.length) {
          const choice = await chooseHotel(fetchSmartPick, destination, trip.preferences, fetchedHotels);
          const hotel = choice?.hotel;
          if (hotel) {
            setSelectedHotelId(hotel.id);
            setHotelPickReason(choice.reason);
            const idx = fetchedHotels.findIndex((h) => h.id === hotel.id);
            if (idx >= 0) setVisibleHotelCount((c) => Math.max(c, idx + 1));
          }
        }
      } catch (e: unknown) {
        // Non-fatal — the type/stars/amenity filters above still applied
        // successfully, the traveller just needs to pick a hotel manually.
        setHotelPickError(e instanceof Error ? e.message : "ZiGy couldn't pick a specific hotel — the filters above are still set, pick one below.");
      } finally {
        setPickingHotel(false);
      }
    }
  }

  function handleContinue() {
    setLodging(assembleLodging(draft));

    setReviewSourcePref(
      reviewMode === "single" && reviewSource
        ? { mode: "single", source: reviewSource }
        : { mode: "cross_reference" }
    );

    const picked = displayHotels.find((h) => h.id === selectedHotelId) ?? null;
    setLodgingPick(picked);
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

  const hasType = effectiveTypes.length > 0;
  // Only show hotel picker if accommodation type includes bookable hotel options
  const airbnbOnly = isAirbnbOnly(effectiveTypes);
  // Falls back to the persisted selection when the current `hotels` fetch
  // hasn't (re-)included it yet — e.g. a returning visit before this step's
  // own fetch effect has resolved.
  const topPickedHotel = selectedHotelId
    ? hotels.find((h) => h.id === selectedHotelId) ??
      (savedPick?.id === selectedHotelId ? savedPick : null)
    : null;

  function renderHotelCard(h: HotelOption) {
    return (
      <LodgingHotelCard
        key={h.id}
        hotel={h}
        selected={selectedHotelId === h.id}
        onToggle={() => setSelectedHotelId((prev) => (prev === h.id ? null : h.id))}
        currency={trip.preferences.preferredCurrency}
      />
    );
  }

  // "Let ZiGy plan my whole trip" (chosen on the Planning Mode step just
  // before this one) means this step's own "I'll pick myself vs. let ZiGy
  // choose" prompt would be redundant — auto-run the exact same ZiGy pick
  // path a manual click on that card would trigger, once, so the traveller
  // lands directly on the review screen instead of having to choose again.
  const autoPlanRef = useRef(false);
  useEffect(() => {
    if (!trip.preferences.autoPlanEverything || existing || mode !== "prompt" || autoPlanRef.current) return;
    autoPlanRef.current = true;
    setModeChoice("zigy");
    (async () => {
      await handleZigyPick();
      setMode("zigy_review");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trip.preferences.autoPlanEverything, existing, mode]);

  async function handlePromptContinue() {
    if (modeChoice === "manual") setMode("manual");
    else if (modeChoice === "zigy") {
      await handleZigyPick();
      setMode("zigy_review");
    }
    scrollStepToTop(); // switching views here doesn't remount the step
    return false; // stay on this step — just switches to the picker view
  }

  if (mode === "prompt") {
    return (
      <StepShell
        stepId="lodging"
        continueLabel="Continue"
        continueDisabled={!modeChoice}
        continueLoading={picking || pickingHotel}
        onContinue={handlePromptContinue}
        subtitle="How do you want to choose your lodging preferences?"
        headerImage="/zigy-lodging.png"
      >
        <ChooseModePrompt
          manualLabel="I'll pick myself"
          manualDescription="Choose the accommodation type, star rating, and amenities that matter to you."
          zigyDescription="I'll suggest top-rated stays that fit the vibe of your trip, your destination, and your budget — you can still adjust before continuing."
          selected={modeChoice}
          onSelect={setModeChoice}
          loading={picking}
          error={pickError}
        />
      </StepShell>
    );
  }

  if (mode === "zigy_review") {
    const pickedHotel = displayHotels.find((h) => h.id === selectedHotelId) ?? null;
    const reasoning = [pickSummary, hotelPickReason].filter(Boolean).join(" ");

    return (
      <StepShell
        stepId="lodging"
        onContinue={handleContinue}
        continueDisabled={!hasType}
        subtitle="Here's what ZiGy picked for your stay."
        headerImage="/zigy-lodging.png"
      >
        <div className="flex flex-col gap-4">
          {reasoning && (
            <div className="rounded-lg bg-brand-50 px-3 py-2">
              <p className="text-xs text-brand-600">
                <Sparkles size={11} className="inline mr-1" />
                {reasoning}
              </p>
            </div>
          )}
          {(pickError || hotelPickError) && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700">{pickError || hotelPickError}</p>
            </div>
          )}

          {airbnbOnly ? (
            <div className="rounded-xl border border-brand-100 bg-brand-50 px-4 py-3 text-sm text-brand-700">
              <p className="font-medium">AirBnB options will be surfaced in your itinerary.</p>
              <p className="text-xs text-brand-500 mt-0.5">We&apos;ll recommend apartments and local stays that match your destination and dates.</p>
            </div>
          ) : pickedHotel ? (
            <div className="max-w-xs">{renderHotelCard(pickedHotel)}</div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-center">
              <p className="text-sm text-slate-500">ZiGy couldn&apos;t lock in a specific hotel.</p>
              <p className="text-xs text-slate-400 mt-1">The type, star, and amenity picks above still applied — choose a hotel below or adjust the filters yourself.</p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setMode("manual")}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              I&apos;ll choose instead
            </button>
            {!airbnbOnly && hotels.length > 1 && (
              <button
                type="button"
                onClick={() => setShowMoreHotels((v) => !v)}
                className="rounded-lg border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 transition-colors"
              >
                {showMoreHotels ? "Hide other options" : "Show me other options"}
              </button>
            )}
          </div>

          {showMoreHotels && !airbnbOnly && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {displayHotels.map(renderHotelCard)}
            </div>
          )}
        </div>
      </StepShell>
    );
  }

  return (
    <StepShell
      stepId="lodging"
      onContinue={handleContinue}
      continueDisabled={!hasType}
      subtitle="We'll surface options that match your taste."
      headerImage="/zigy-lodging.png"
    >
      {/* Always rendered, regardless of modeChoice — a returning user whose
          `mode` starts at "manual" directly (never visiting the initial
          prompt) can still reach this button, and it needs to reflect
          whether a pick has actually happened rather than only tracking
          modeChoice, which that path never sets. */}
      <ModeToggleBanner
        label="Lodging preferences for you to choose from — or let ZiGy pick."
        onZigy={handleZigyPick}
        loading={picking || pickingHotel}
        error={pickSummary ? null : pickError}
        picked={!!pickSummary}
      />
      {/* A picked banner's own error slot is suppressed above — surface a
          failure separately so it doesn't vanish along with the closed state. */}
      {pickSummary && pickError && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
          <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
          <p className="text-xs text-red-700">{pickError}</p>
        </div>
      )}
      <div className="flex flex-col gap-6">
        {pickSummary && (
          <div className="rounded-lg bg-brand-50 px-3 py-2">
            <p className="text-xs text-brand-600">
              <Sparkles size={11} className="inline mr-1" />
              {pickSummary}
            </p>
            <p className="mt-1 text-[10px] text-brand-400">
              Nothing&apos;s locked in — tweak away below!
            </p>
          </div>
        )}
        {/* Surfaces the actual selection right where the reasoning is, since
            "Choose your stay" sits at the bottom of this long form — without
            this, confirming what got picked meant scrolling past every
            filter section below. */}
        {topPickedHotel && (
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Your selected stay</p>
            {hotelPickReason && (
              <div className="mb-2 rounded-lg bg-brand-50 px-3 py-2">
                <p className="text-xs text-brand-600">
                  <Sparkles size={11} className="inline mr-1" />
                  {hotelPickReason}
                </p>
              </div>
            )}
            <div className="max-w-xs">{renderHotelCard(topPickedHotel)}</div>
          </div>
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
              onChange={handleOtherTypeChange}
              onToggle={handleOtherTypeToggle}
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
                onClick={handleAmenityOpen}
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
                  onChange={(e) => handleOtherAmenityChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && otherAmenity.trim()) { setAmenityOpen(false); syncLodging({ amenityOpen: false }); }
                    if (e.key === "Escape") handleAmenityClear();
                  }}
                  placeholder="e.g. EV charging…"
                  className="rounded-full border border-brand-400 px-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-brand-400 w-36"
                />
                <button
                  type="button"
                  onClick={handleAmenityClear}
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
            <p className="text-xs text-brand-500 mt-0.5">We&apos;ll recommend apartments and local stays that match your destination and dates.</p>
          </div>
        )}

        {/* Hotel picker */}
        {!airbnbOnly && hasType && (
          <div className="border-t border-slate-100 pt-5">
            <p className="mb-1 text-sm font-medium text-slate-700">Choose your stay</p>
            <p className="mb-3 text-xs text-slate-400">
              Lock in a hotel now or skip — you can always choose later.
            </p>

            {hotelPickError && (
              <div className="mb-3 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
                <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
                <p className="text-xs text-red-700">{hotelPickError}</p>
              </div>
            )}

            {hotelsLoading || pickingHotel ? (
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
                {displayHotels.map(renderHotelCard)}
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
