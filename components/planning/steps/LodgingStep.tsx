"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { LodgingPreference, LodgingStarRating, LodgingType } from "@/types/trip";

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

export function LodgingStep() {
  const { trip, setLodging } = useTripStore();
  const existing = trip.preferences.lodging;

  const [types,          setTypes         ] = useState<LodgingType[]>(existing?.types ?? []);
  const [otherTypeOpen,  setOtherTypeOpen ] = useState(false);
  const [otherTypeValue, setOtherTypeValue] = useState("");
  const [minStars,       setMinStars      ] = useState<LodgingStarRating>(existing?.minStars ?? 4);
  const [amenities,      setAmenities     ] = useState<string[]>(existing?.amenities ?? []);
  const [otherAmenity,   setOtherAmenity  ] = useState("");
  const [amenityOpen,    setAmenityOpen   ] = useState(false);

  function toggleType(t: LodgingType) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  function toggleAmenity(a: string) {
    setAmenities((prev) => prev.includes(a) ? prev.filter((x) => x !== a) : [...prev, a]);
  }

  function handleContinue() {
    const allTypes = [...types];
    if (otherTypeOpen && otherTypeValue.trim()) {
      allTypes.push(otherTypeValue.trim() as LodgingType);
    }
    const allAmenities = [...amenities];
    if (amenityOpen && otherAmenity.trim()) {
      allAmenities.push(otherAmenity.trim());
    }
    const pref: LodgingPreference = { types: allTypes, minStars, amenities: allAmenities };
    setLodging(pref);
  }

  const hasType = types.length > 0 || (otherTypeOpen && !!otherTypeValue.trim());

  return (
    <StepShell
      stepId="lodging"
      onContinue={handleContinue}
      continueDisabled={!hasType}
      subtitle="We'll surface options on Booking.com and Airbnb that match your taste."
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
                onClick={() => setMinStars(s)}
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
            {/* Other amenity */}
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
      </div>
    </StepShell>
  );
}
