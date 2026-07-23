"use client";

import { useState } from "react";
import { Star, Info, ChevronDown, ChevronUp, ExternalLink } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { OtherInput } from "@/components/ui/OtherInput";
import { useTripStore } from "@/lib/store/tripStore";
import { getActivitiesByDestination } from "@/lib/data/destinationActivities";
import type { ActivityCategory } from "@/types/trip";

const GENERAL: { id: ActivityCategory; label: string; icon: string; sublabel: string }[] = [
  { id: "guided_walking_tour", label: "Guided Walking Tour", icon: "🚶", sublabel: "Expert-led neighbourhood & history walks" },
  { id: "guided_food_tour",    label: "Guided Food Tour",    icon: "🍽️", sublabel: "Curated culinary walks with a local expert" },
  { id: "hiking",              label: "Hiking",              icon: "🥾", sublabel: "Trails, peaks, national parks" },
  { id: "skiing",              label: "Skiing",              icon: "⛷️", sublabel: "Downhill, backcountry, snow" },
  { id: "sailing",             label: "Sailing",             icon: "⛵", sublabel: "Charters, coastal cruising" },
  { id: "food",                label: "Food Experiences",    icon: "🍜", sublabel: "Markets, tastings, restaurants" },
  { id: "diving",              label: "Diving & Snorkel",    icon: "🤿", sublabel: "Reefs, wrecks, marine life" },
  { id: "cycling",             label: "Cycling",             icon: "🚴", sublabel: "Road biking, mountain biking" },
  { id: "cultural",            label: "Cultural",            icon: "🏛️", sublabel: "History, arts, local traditions" },
  { id: "photography",         label: "Photography",         icon: "📷", sublabel: "Landscapes, architecture, street" },
  { id: "wellness",            label: "Wellness & Spa",      icon: "🧘", sublabel: "Retreats, yoga, thermal baths" },
  { id: "adventure",           label: "Adventure Sports",    icon: "🪂", sublabel: "Paragliding, bungee, white water" },
];

export function ActivitiesStep() {
  const { trip, setActivities } = useTripStore();

  // Destination-specific curated activities
  const destName = trip.preferences.destination?.displayName ?? "";
  const destGroups = getActivitiesByDestination(destName);
  const hasDestActivities = destGroups.some((g) => g.activities.length > 0);

  // Track selected specific activity names (from destination section)
  const [selectedSpecific, setSelectedSpecific] = useState<string[]>([]);
  // Track selected general categories
  const [selectedGeneral,  setSelectedGeneral ] = useState<ActivityCategory[]>(
    trip.preferences.activities.filter((a): a is ActivityCategory =>
      GENERAL.some((g) => g.id === a)
    )
  );
  const [otherOpen,  setOtherOpen ] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  // Track which activity cards have their "why" panel expanded
  const [expandedInfo, setExpandedInfo] = useState<Record<string, boolean>>({});
  const [expandedAlts, setExpandedAlts] = useState<Record<string, boolean>>({});

  function toggleInfo(name: string) {
    setExpandedInfo((prev) => ({ ...prev, [name]: !prev[name] }));
  }
  function toggleAlts(name: string) {
    setExpandedAlts((prev) => ({ ...prev, [name]: !prev[name] }));
  }

  function toggleSpecific(name: string) {
    setSelectedSpecific((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }

  function toggleGeneral(id: ActivityCategory) {
    setSelectedGeneral((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    const all: string[] = [
      ...selectedGeneral,
      ...selectedSpecific,
      ...(otherOpen && otherValue.trim() ? [otherValue.trim()] : []),
    ];
    setActivities(all);
  }

  const totalSelected =
    selectedGeneral.length +
    selectedSpecific.length +
    (otherOpen && otherValue.trim() ? 1 : 0);

  return (
    <StepShell
      stepId="activities"
      onContinue={handleContinue}
      continueDisabled={totalSelected === 0}
      subtitle="Select what you'd love to do — we've surfaced the best picks for your destination."
    >
      {/* ── Destination-specific section ── */}
      {hasDestActivities && (
        <div className="mb-6">
          {destGroups.map((group) => (
            <div key={group.destination} className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold uppercase tracking-widest text-brand-500">
                  Top picks for {group.destination}
                </span>
                <div className="flex-1 h-px bg-brand-100" />
              </div>
              <div className="flex flex-col gap-2">
                {group.activities.map((a) => {
                  const isSelected = selectedSpecific.includes(a.name);
                  const showInfo = expandedInfo[a.name];
                  const showAlts = expandedAlts[a.name];
                  const hasExtra = !!(a.providerWhy || a.guideNote || a.alternatives?.length);

                  return (
                    <div
                      key={a.name}
                      className={`rounded-xl border transition-all duration-150 ${
                        isSelected
                          ? "border-brand-500 bg-brand-50"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                      }`}
                    >
                      {/* ── Main row ── */}
                      <button
                        type="button"
                        onClick={() => toggleSpecific(a.name)}
                        className="flex w-full items-start gap-3 px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-xl"
                      >
                        <span className="text-xl shrink-0 mt-0.5">{a.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-sm font-medium ${isSelected ? "text-brand-700" : "text-slate-800"}`}>
                              {a.name}
                            </span>
                            {a.isSignature && (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                                <Star size={9} className="fill-amber-500 text-amber-500" />
                                Signature experience
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
                            {a.description}
                          </p>
                        </div>
                        <span className={`shrink-0 mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all ${
                          isSelected ? "border-brand-500 bg-brand-500" : "border-slate-300"
                        }`}>
                          {isSelected && (
                            <svg className="h-3 w-3 text-white" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </span>
                      </button>

                      {/* ── Provider info toggles ── */}
                      {hasExtra && (
                        <div className="px-4 pb-3 flex flex-wrap gap-2 border-t border-slate-100 pt-2 mt-0">
                          {(a.providerWhy || a.guideNote) && (
                            <button
                              type="button"
                              onClick={() => toggleInfo(a.name)}
                              className="flex items-center gap-1 text-[11px] text-brand-500 hover:text-brand-700 transition-colors"
                            >
                              <Info size={11} />
                              {showInfo ? "Hide details" : "Why we recommend this"}
                              {showInfo ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                          {a.alternatives?.length && (
                            <button
                              type="button"
                              onClick={() => toggleAlts(a.name)}
                              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600 transition-colors"
                            >
                              {showAlts ? "Hide alternatives" : "Other providers"}
                              {showAlts ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                            </button>
                          )}
                        </div>
                      )}

                      {/* ── Provider why / guide note panel ── */}
                      {showInfo && (a.providerWhy || a.guideNote) && (
                        <div className="mx-4 mb-3 rounded-lg bg-brand-50 border border-brand-100 px-3 py-2.5 space-y-2">
                          {a.providerWhy && (
                            <p className="text-xs text-slate-600 leading-relaxed">{a.providerWhy}</p>
                          )}
                          {a.guideNote && (
                            <p className="text-xs text-slate-500 leading-relaxed italic">
                              <span className="font-medium not-italic text-slate-600">About guides: </span>
                              {a.guideNote}
                            </p>
                          )}
                        </div>
                      )}

                      {/* ── Alternatives panel ── */}
                      {showAlts && a.alternatives?.length && (
                        <div className="mx-4 mb-3 rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5">
                          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                            Other providers to consider
                          </p>
                          <div className="space-y-1.5">
                            {a.alternatives.map((alt) => (
                              <div key={alt.name} className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <a
                                    href={`https://${alt.url}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-xs font-medium text-brand-600 hover:underline flex items-center gap-0.5"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {alt.name} <ExternalLink size={9} />
                                  </a>
                                  <p className="text-[10px] text-slate-400 leading-tight">{alt.note}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── General activity categories ── */}
      <div className={hasDestActivities ? "border-t border-slate-100 pt-5" : ""}>
        {hasDestActivities && (
          <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Or choose by activity type
          </p>
        )}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {GENERAL.map((a) => (
            <SelectChip
              key={a.id}
              label={a.label}
              icon={a.icon}
              sublabel={a.sublabel}
              selected={selectedGeneral.includes(a.id)}
              onClick={() => toggleGeneral(a.id)}
            />
          ))}
          <OtherInput
            selected={otherOpen}
            value={otherValue}
            onChange={setOtherValue}
            onToggle={() => setOtherOpen((v) => !v)}
            placeholder="e.g. Surfing, Bird watching…"
          />
        </div>
      </div>

      {totalSelected > 0 && (
        <p className="mt-4 text-xs text-slate-500">
          {totalSelected} activit{totalSelected === 1 ? "y" : "ies"} selected
        </p>
      )}
    </StepShell>
  );
}
