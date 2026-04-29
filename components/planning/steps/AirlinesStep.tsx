"use client";

import { useState } from "react";
import { Plane } from "lucide-react";
import { StepShell } from "@/components/planning/StepShell";
import { SelectChip } from "@/components/ui/SelectChip";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { AirlinePreference, AirlineAlliance } from "@/types/trip";

const AIRLINES = [
  { name: "Delta Air Lines",   code: "DL", icon: "✈️" },
  { name: "United Airlines",   code: "UA", icon: "✈️" },
  { name: "American Airlines", code: "AA", icon: "✈️" },
  { name: "Emirates",          code: "EK", icon: "✈️" },
  { name: "Singapore Airlines",code: "SQ", icon: "✈️" },
  { name: "Lufthansa",         code: "LH", icon: "✈️" },
  { name: "British Airways",   code: "BA", icon: "✈️" },
  { name: "Air France",        code: "AF", icon: "✈️" },
  { name: "Qatar Airways",     code: "QR", icon: "✈️" },
  { name: "Cathay Pacific",    code: "CX", icon: "✈️" },
];

const ALLIANCES: { id: AirlineAlliance; label: string; members: string }[] = [
  { id: "star_alliance", label: "Star Alliance", members: "United, Lufthansa, Singapore, ANA + more" },
  { id: "oneworld",      label: "Oneworld",      members: "American, British Airways, Cathay, Qantas + more" },
  { id: "skyteam",       label: "SkyTeam",       members: "Delta, Air France, KLM, Korean Air + more" },
];

const CABINS = ["economy", "premium_economy", "business", "first"] as const;
const CABIN_LABELS: Record<string, string> = {
  economy: "Economy", premium_economy: "Premium Economy",
  business: "Business", first: "First Class",
};

export function AirlinesStep() {
  const { trip, setAirlines } = useTripStore();
  const existing = trip.preferences.airlinePrefs;

  const [selectedAirlines,  setSelectedAirlines ] = useState<string[]>(existing?.airlines ?? []);
  const [selectedAlliances, setSelectedAlliances] = useState<AirlineAlliance[]>(existing?.alliances ?? []);
  const [preferNonstop,     setPreferNonstop    ] = useState(existing?.preferNonstop ?? true);
  const [cabin,             setCabin            ] = useState<string>(existing?.cabinClass ?? "business");

  function toggleAirline(name: string) {
    setSelectedAirlines((prev) =>
      prev.includes(name) ? prev.filter((a) => a !== name) : [...prev, name]
    );
  }
  function toggleAlliance(id: AirlineAlliance) {
    setSelectedAlliances((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  }

  function handleContinue() {
    const pref: AirlinePreference = {
      airlines: selectedAirlines,
      alliances: selectedAlliances,
      preferNonstop,
      cabinClass: cabin as AirlinePreference["cabinClass"],
    };
    setAirlines(pref);
  }

  return (
    <StepShell
      stepId="airlines"
      onContinue={handleContinue}
      subtitle="Skip this step if you have no preference — we'll find the best value flights."
    >
      <div className="flex flex-col gap-6">
        {/* Airlines */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Preferred airlines <span className="text-slate-400 font-normal">(optional)</span></p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {AIRLINES.map((a) => (
              <SelectChip
                key={a.name}
                label={a.name}
                icon={a.icon}
                selected={selectedAirlines.includes(a.name)}
                onClick={() => toggleAirline(a.name)}
              />
            ))}
          </div>
        </div>

        {/* Alliances */}
        <div>
          <p className="mb-2 text-sm font-medium text-slate-700">Or choose by alliance</p>
          <div className="flex flex-col gap-2">
            {ALLIANCES.map((al) => (
              <SelectChip
                key={al.id}
                label={al.label}
                sublabel={al.members}
                selected={selectedAlliances.includes(al.id)}
                onClick={() => toggleAlliance(al.id)}
                className="w-full"
              />
            ))}
          </div>
        </div>

        {/* Cabin & nonstop */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Cabin class</p>
            <div className="flex flex-col gap-1.5">
              {CABINS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCabin(c)}
                  className={cn(
                    "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-left transition-all",
                    cabin === c
                      ? "border-brand-500 bg-brand-50 text-brand-700"
                      : "border-slate-200 text-slate-600 hover:border-slate-300"
                  )}
                >
                  <Plane size={12} />
                  {CABIN_LABELS[c]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Routing</p>
            <button
              type="button"
              onClick={() => setPreferNonstop(!preferNonstop)}
              className={cn(
                "flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-all w-full",
                preferNonstop
                  ? "border-brand-500 bg-brand-50 text-brand-700"
                  : "border-slate-200 text-slate-600 hover:border-slate-300"
              )}
            >
              ✈️ Prefer nonstop
            </button>
          </div>
        </div>
      </div>
    </StepShell>
  );
}
