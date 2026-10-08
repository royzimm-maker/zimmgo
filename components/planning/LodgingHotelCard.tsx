"use client";

import { Star, ExternalLink, Check } from "lucide-react";
import { cn, formatCurrency } from "@/lib/utils";
import type { HotelOption } from "@/types/trip";

const HOTEL_TIER: Record<number, string> = {
  5: "The full five-star treatment",
  4: "Seriously comfortable, no drama",
  3: "Sleep well, spend the savings",
};

// A hotel on the Lodging step — the same card in the manual grid and in the
// "show me other options" list on the ZimmGo-review screen. Clicking toggles it
// as the traveller's pick.
export function LodgingHotelCard({
  hotel: h,
  selected,
  onToggle,
  currency,
}: {
  hotel: HotelOption;
  selected: boolean;
  onToggle: () => void;
  currency?: string;
}) {
  const tierLabel = HOTEL_TIER[h.stars] ?? HOTEL_TIER[4];
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => e.key === "Enter" && onToggle()}
      className={cn(
        "flex flex-col rounded-xl border overflow-hidden cursor-pointer transition-all duration-150",
        selected
          ? "border-brand-500 ring-2 ring-brand-200 bg-brand-50/40"
          : "border-slate-200 hover:border-slate-300 bg-white"
      )}
    >
      {h.imageUrl && (
        <div className="relative w-full h-28 shrink-0 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={h.imageUrl} alt={h.name} className="w-full h-full object-cover" />
          {!h.google && (
            <span
              className="absolute top-1.5 left-1.5 rounded-full px-2 py-0.5 text-[9px] font-semibold shadow-sm"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
            >
              {tierLabel}
            </span>
          )}
          {selected && (
            <span className="absolute top-1.5 right-1.5 flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[9px] font-bold text-white shadow">
              <Check size={9} /> Your pick
            </span>
          )}
          {h.google ? (
            h.google.photoAttribution && (
              <a href={h.google.photoAttribution.uri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}
                className="absolute bottom-1 right-1.5 max-w-[80%] truncate rounded bg-black/50 px-1.5 py-0.5 text-[8px] text-white/80 font-medium hover:underline">
                Photo: {h.google.photoAttribution.name}
              </a>
            )
          ) : (
            <span className="absolute bottom-1 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[8px] text-white/80 font-medium tracking-wide">
              Illustrative
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col flex-1 p-3">
        <div className="flex items-center gap-1">
          {Array.from({ length: h.stars }).map((_, i) => (
            <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
          ))}
        </div>
        <span className={cn("mt-1 font-semibold text-sm leading-tight", selected ? "text-brand-700" : "text-slate-800")}>
          {h.name}
        </span>
        {!h.imageUrl && !h.google && <p className="text-[11px] text-slate-500 mt-0.5 italic">{tierLabel}</p>}
        <p className="text-[11px] text-slate-400 mt-0.5">{h.location}</p>
        {h.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{h.description}</p>}

        <div className="flex-1" />

        <div className="mt-3 flex items-end justify-between gap-2 pt-2 border-t border-slate-100">
          <div>
            <p className="font-bold text-slate-900 text-sm">
              {h.priceIsEstimate && "~"}{formatCurrency(h.pricePerNight, currency)}<span className="font-normal text-xs text-slate-400">/night{h.priceIsEstimate && " est."}</span>
            </p>
            {h.google ? (
              // Google's own figure (stored ×2 on the app's 10-point scale), credited to Google Maps.
              <a href={h.google.mapsUri} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="block hover:underline">
                <p className="text-xs text-sage-700 font-medium">{(h.rating / 2).toFixed(1)}★</p>
                <p className="text-[9px] text-slate-400">{h.reviewCount.toLocaleString()} on Google Maps</p>
              </a>
            ) : (
              <p className="text-xs text-sage-700 font-medium">{h.rating}/10</p>
            )}
          </div>
          {selected ? (
            !h.imageUrl && (
              <span className="flex items-center gap-1 rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white shrink-0">
                <Check size={9} /> Your pick
              </span>
            )
          ) : (
            <a
              href={h.bookingUrl}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="shrink-0 flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline"
            >
              {h.google ? "Check prices" : "View"} <ExternalLink size={9} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
