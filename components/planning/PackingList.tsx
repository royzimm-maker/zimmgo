"use client";

import { useState } from "react";
import { Luggage, ChevronDown, ChevronUp, Check } from "lucide-react";
import type { GeneratedItinerary, TripPreferences } from "@/types/trip";

interface PackingCategory {
  name: string;
  emoji: string;
  items: string[];
}

function buildPackingList(preferences: TripPreferences, itinerary: GeneratedItinerary): PackingCategory[] {
  const activities = preferences.activities.map((a) => String(a));
  const duration = itinerary.days.length;
  const firstDate = itinerary.days[0]?.date ?? preferences.dates?.startDate ?? "";
  const month = firstDate ? new Date(firstDate).getMonth() : new Date().getMonth();
  const isWarm = month >= 3 && month <= 9;

  const essentials = [
    "Passport (check expiry — needs 6+ months validity)",
    "Travel insurance documents",
    "Credit & debit cards (notify your bank)",
    "Phone + charger",
    "Universal travel adapter",
    "Any prescription medications",
    "Photocopies of key documents (keep separate)",
  ];

  const clothing: string[] = isWarm
    ? ["Lightweight shirts/tops", "Shorts or light trousers", "Sunglasses", "Sun hat or cap", "Comfortable walking shoes", "Smart casual outfit for dining out", "Light cardigan/jacket for evenings"]
    : ["Warm mid-layers", "Waterproof outer jacket", "Gloves and scarf", "Waterproof boots", "Thermal base layers", "Comfortable walking shoes", "Smart outfit for dining"];

  if (duration > 7) {
    clothing.push("Extra socks and underwear", "Laundry bag or travel detergent");
  }

  const activityGear: string[] = [];
  if (activities.some((a) => a === "hiking")) {
    activityGear.push("Hiking boots (broken in)", "Trekking poles", "Moisture-wicking socks", "Daypack (20-30L)");
  }
  if (activities.some((a) => a === "skiing")) {
    activityGear.push("Ski gloves", "Goggles", "Thermal base layers", "Neck gaiter", "Hand warmers");
  }
  if (activities.some((a) => a === "diving" || a.toLowerCase().includes("snorkel"))) {
    activityGear.push("Reef-safe sunscreen", "Rash guard", "Underwater camera or GoPro");
  }
  if (activities.some((a) => a === "sailing")) {
    activityGear.push("Non-slip boat shoes", "Windproof jacket", "Polarised sunglasses");
  }
  if (activities.some((a) => a === "cycling")) {
    activityGear.push("Padded cycling shorts", "Cycling gloves", "Helmet (or check rental availability)");
  }
  if (activities.some((a) => a === "photography")) {
    activityGear.push("Camera + extra batteries", "Spare memory cards", "Compact tripod", "Lens cleaning cloth");
  }
  if (activities.some((a) => a === "wellness")) {
    activityGear.push("Yoga mat (or check hotel)", "Workout clothes", "Flip flops for spa/pool");
  }
  if (activities.some((a) => a === "food" || a === "guided_food_tour")) {
    activityGear.push("Antacids (you will eat a lot)", "Loose-fit trousers for feast days");
  }

  const health = [
    "Sunscreen SPF 50+",
    "Insect repellent",
    "Basic first-aid kit (plasters, antiseptic wipes)",
    "Pain relievers and anti-inflammatory",
    "Stomach/digestive remedies",
    "Hand sanitiser",
    "Face masks (handy for long-haul flights)",
  ];

  const tech = [
    "Portable charger / power bank",
    "Download offline maps (Google Maps or Maps.me)",
    "Translation app (Google Translate with offline pack)",
    "Airline app + boarding passes downloaded",
    "VPN app (useful in some countries)",
    "E-reader or downloaded entertainment for flights",
  ];

  const categories: PackingCategory[] = [
    { name: "Essentials", emoji: "🔑", items: essentials },
    { name: "Clothing", emoji: "👕", items: clothing },
    ...(activityGear.length ? [{ name: "Activity Gear", emoji: "🎒", items: activityGear }] : []),
    { name: "Health & Safety", emoji: "💊", items: health },
    { name: "Tech", emoji: "📱", items: tech },
  ];

  return categories;
}

interface Props {
  itinerary: GeneratedItinerary;
  preferences: TripPreferences;
}

export function PackingList({ itinerary, preferences }: Props) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const categories = buildPackingList(preferences, itinerary);
  const total = categories.reduce((s, c) => s + c.items.length, 0);
  const done = checked.size;

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Luggage size={15} className="text-brand-500" />
          <span className="text-sm font-semibold text-slate-800">Packing List</span>
        </div>
        <div className="flex items-center gap-3">
          {open && done > 0 && (
            <span className="text-xs text-sage-600 font-medium">{done}/{total} packed</span>
          )}
          {open ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {categories.map((cat) => (
            <div key={cat.name} className="px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
                {cat.emoji} {cat.name}
              </p>
              <div className="flex flex-col gap-1.5">
                {cat.items.map((item) => {
                  const key = `${cat.name}:${item}`;
                  const isDone = checked.has(key);
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex items-start gap-2 text-left"
                    >
                      <span className={`shrink-0 mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition-all ${
                        isDone ? "border-sage-500 bg-sage-500" : "border-slate-300"
                      }`}>
                        {isDone && <Check size={10} className="text-white" />}
                      </span>
                      <span className={`text-xs leading-relaxed ${isDone ? "line-through text-slate-400" : "text-slate-700"}`}>
                        {item}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {done === total && total > 0 && (
            <div className="px-4 py-3 text-center text-sm text-sage-600 font-medium bg-sage-50">
              ✓ All packed — have an amazing trip!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
