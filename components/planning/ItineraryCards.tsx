"use client";

// Option cards and section layout shared by the itinerary view and the
// review wizard (flights, ground transport, hotels, restaurants, activities).
import { Star, MapPin, ExternalLink, Check, Heart, Ship, TrainFront } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { formatCurrency, pairFlights, groupByLocation } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { FlightOption, HotelOption, ActivityOption, RestaurantOption, TransportOption } from "@/types/trip";

export function Section({ title, icon, subtitle, children }: { title: string; icon: React.ReactNode; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-brand-500">{icon}</span>
        <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
      </div>
      {subtitle && <p className="text-xs text-slate-400 mb-3 pl-6">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </div>
  );
}

// Groups items by their `location` field and renders them under a location header
export function GroupedCards<T extends { location?: string }>({
  items,
  renderCard,
  gridCols = false,
}: {
  items: T[];
  renderCard: (item: T) => React.ReactNode;
  gridCols?: boolean;
}) {
  const groups = groupByLocation(items, (i) => i.location);
  const singleGroup = groups.length === 1;

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <div key={g.location}>
          {!singleGroup && (
            <div className="flex items-center gap-2 mb-2">
              <MapPin size={11} className="text-brand-400 shrink-0" />
              <p className="text-xs font-semibold text-brand-600 uppercase tracking-wide">{g.location}</p>
              <div className="flex-1 border-t border-brand-100" />
            </div>
          )}
          <div className={gridCols ? "grid grid-cols-1 gap-2 sm:grid-cols-2" : "flex flex-col gap-2"}>
            {g.items.map((item) => renderCard(item))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function StatCard({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3 text-center">
      <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">{icon}<span className="text-xs">{label}</span></div>
      <p className="font-bold text-slate-800 text-sm">{value}</p>
    </div>
  );
}

export function FlightPairList({
  flights,
  arrivalAirport,
  selectedFlightId,
  onSelect,
}: {
  flights: FlightOption[];
  arrivalAirport: string;
  selectedFlightId?: string;
  onSelect: (f: FlightOption) => void;
}) {
  const pairs = pairFlights(flights, arrivalAirport);
  const { trip } = useTripStore();
  const currency = trip.preferences.preferredCurrency;

  return (
    <div className="flex flex-col gap-3">
      {pairs.map(({ outbound: o, ret }) => {
        const roundtripPp = o.price + (ret?.price ?? 0);
        const isSelected = selectedFlightId === o.id;
        return (
          <Card
            key={o.id}
            padding="sm"
            className={`transition-all ${isSelected ? "border-brand-400 ring-2 ring-brand-100" : ""}`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-slate-800 text-sm">{o.airline}</span>
                  <Badge variant="info">{o.cabinClass}</Badge>
                  {o.stops === 0 && <Badge variant="success">Nonstop</Badge>}
                </div>
                <div className="mt-1 text-xs text-slate-500 flex flex-col gap-0.5">
                  <span>Outbound: {o.origin} → {o.destination} · {o.duration}</span>
                  {ret && <span>Return: {ret.origin} → {ret.destination} · {ret.duration}</span>}
                </div>
                {ret && (
                  <p className="text-[10px] text-slate-400 mt-1">
                    Out {formatCurrency(o.price, currency)}/pp + Return {formatCurrency(ret.price, currency)}/pp
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="font-bold text-slate-900 text-sm">{formatCurrency(roundtripPp, currency)}</p>
                <p className="text-[10px] text-slate-400">roundtrip/pp</p>
              </div>
            </div>
            <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => onSelect(o)}
                className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
                  isSelected
                    ? "bg-brand-600 text-white"
                    : "border border-brand-300 text-brand-700 hover:bg-brand-50"
                }`}
              >
                {isSelected && <Check size={11} />}
                {isSelected ? "Selected" : "Select this flight"}
              </button>
              <a
                href={o.bookingUrl ?? "https://www.google.com/travel/flights"}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-0.5 text-xs text-brand-500 hover:underline ml-auto font-medium"
              >
                Book with airline <ExternalLink size={10} />
              </a>
            </div>
          </Card>
        );
      })}
      <p className="text-[10px] text-slate-400 text-center">
        Estimates only — prices change. Booking opens the airline&apos;s site in a new tab.
      </p>
    </div>
  );
}

export function TransportCard({
  option,
  selected = false,
  onSelect,
}: {
  option: TransportOption;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { trip } = useTripStore();
  const currency = trip.preferences.preferredCurrency;
  const ModeIcon = option.mode === "ferry" ? Ship : TrainFront;

  return (
    <Card padding="sm" className={`transition-all ${selected ? "border-brand-400 ring-2 ring-brand-100" : ""}`}>
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <ModeIcon size={15} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{option.provider}</span>
            <Badge variant="info">{option.mode === "ferry" ? "Ferry" : "Train"}</Badge>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            {option.fromCity} → {option.toCity} · {option.duration}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-900 text-sm">{formatCurrency(option.price, currency)}</p>
          <p className="text-[10px] text-slate-400">per person</p>
        </div>
      </div>
      {onSelect && (
        <div className="flex items-center gap-3 mt-2.5 pt-2 border-t border-slate-100">
          <button
            type="button"
            onClick={onSelect}
            className={`flex items-center gap-1 rounded-md px-3 py-1 text-xs font-semibold transition-colors ${
              selected ? "bg-brand-600 text-white" : "border border-brand-300 text-brand-700 hover:bg-brand-50"
            }`}
          >
            {selected && <Check size={11} />}
            {selected ? "Selected" : "Select this option"}
          </button>
          {option.bookingUrl && (
            <a
              href={option.bookingUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-0.5 text-xs text-brand-500 hover:underline ml-auto font-medium"
            >
              Book with {option.provider} <ExternalLink size={10} />
            </a>
          )}
        </div>
      )}
    </Card>
  );
}

const HOTEL_TIER: Record<number, { label: string }> = {
  5: { label: "The full five-star treatment" },
  4: { label: "Seriously comfortable, no drama" },
  3: { label: "Sleep well, spend the savings" },
};

export function HotelCard({ hotel, selected = false, onSelect }: { hotel: HotelOption; selected?: boolean; onSelect?: () => void }) {
  const sourceIcon: Record<string, string> = {
    "Google Reviews": "🔵",
    "TripAdvisor": "🟢",
    "Booking.com": "🔷",
  };
  const icon = hotel.ratingSource ? (sourceIcon[hotel.ratingSource] ?? "⭐") : "⭐";
  const tierLabel = (HOTEL_TIER[hotel.stars] ?? HOTEL_TIER[4]).label;
  const { trip } = useTripStore();

  return (
    <div
      role={onSelect ? "button" : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={(e) => e.key === "Enter" && onSelect?.()}
      className={`rounded-xl border overflow-hidden transition-all duration-150 ${
        selected
          ? "border-brand-500 ring-2 ring-brand-200"
          : onSelect
            ? "border-slate-200 hover:border-slate-300 cursor-pointer"
            : "border-slate-200"
      }`}
    >
      {/* Hotel image */}
      {hotel.imageUrl && (
        <div className="relative w-full h-36 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.imageUrl}
            alt={hotel.name}
            className="w-full h-full object-cover"
          />
          <span className="absolute top-2 left-2 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide shadow-sm" style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}>
            {tierLabel}
          </span>
          {selected && (
            <span className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold text-white shadow">
              ✓ Your pick
            </span>
          )}
          <span className="absolute bottom-1.5 right-2 rounded bg-black/50 px-1.5 py-0.5 text-[9px] text-white/80 font-medium tracking-wide">
            Illustrative
          </span>
        </div>
      )}
      <div className="flex items-start gap-3 p-3">
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className={`font-semibold text-sm ${selected ? "text-brand-700" : "text-slate-800"}`}>{hotel.name}</span>
            <div className="flex">
              {Array.from({ length: hotel.stars }).map((_, i) => (
                <Star key={i} size={10} className="fill-amber-400 text-amber-400" />
              ))}
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{hotel.location}</p>
          <div className="flex flex-wrap gap-1 mt-2">
            {hotel.highlights.slice(0, 3).map((h) => (
              <Badge key={h} variant="muted">{h}</Badge>
            ))}
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className="font-bold text-slate-900 text-sm">
            {formatCurrency(hotel.pricePerNight, trip.preferences.preferredCurrency)}<span className="font-normal text-xs text-slate-400">/night</span>
          </p>
          <p className="text-xs text-slate-500 mt-0.5">
            <span className="font-medium text-sage-600">{hotel.rating}/10</span>
            {" · "}{hotel.reviewCount.toLocaleString()} reviews
          </p>
          {hotel.ratingSource && (
            <p className="text-[10px] text-slate-400 mt-0.5">{icon} {hotel.ratingSource}</p>
          )}
          {hotel.sourceRatings && (
            <p className="text-[9px] text-slate-400 mt-0.5">
              {hotel.sourceRatings.map((s) => `${s.source} ${s.rating}`).join(" · ")}
            </p>
          )}
          <div className="flex items-center gap-2 justify-end mt-1.5">
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(hotel.name + " " + hotel.location)}`}
              target="_blank" rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-xs text-slate-400 hover:text-slate-600 hover:underline flex items-center gap-0.5"
              title="View on Google Maps"
            >
              Map <ExternalLink size={9} />
            </a>
            {hotel.bookingUrl && (
              <a href={hotel.bookingUrl} target="_blank" rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 font-medium">
                Book <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const RESTAURANT_TIER_EMOJI: Record<string, string> = {
  fine_dining: "🌟",
  upscale:     "✨",
  midrange:    "💫",
  casual:      "🪑",
  street_food: "🛺",
  brunch:      "☕",
};

const PRICE_LABEL_COLOR: Record<string, string> = {
  "$$$$": "text-amber-700",
  "$$$":  "text-brand-700",
  "$$":   "text-sage-700",
  "$":    "text-slate-600",
};

export function RestaurantCard({
  restaurant: r,
  saved = false,
  onSave,
  selected = false,
  onSelect,
}: {
  restaurant: RestaurantOption;
  saved?: boolean;
  onSave?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const emoji = RESTAURANT_TIER_EMOJI[r.tier] ?? "🍽️";
  const priceColor = PRICE_LABEL_COLOR[r.priceRange] ?? "text-slate-600";

  return (
    <Card padding="none" selected={selected} className="overflow-hidden">
      <div className="p-3 flex gap-3">
        {r.imageUrl && (
          <div className="relative w-16 h-16 shrink-0 rounded-lg overflow-hidden bg-slate-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={r.imageUrl} alt={r.name} className="w-full h-full object-cover" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="font-semibold text-slate-800 text-sm truncate">{r.name}</p>
                <span className={`text-xs font-bold shrink-0 ${priceColor}`}>{r.priceRange}</span>
                {r.michelinDistinction && <Badge variant="warning">🎖️ {r.michelinDistinction}</Badge>}
                {r.isBeliPick && <Badge variant="success">Beli pick</Badge>}
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">{emoji} {r.cuisine} · {r.location}</p>
              <p className="text-xs text-slate-600 mt-1 line-clamp-1">{r.description}</p>
            </div>
            <div className="text-right shrink-0 flex flex-col items-end gap-1">
              <div className="flex flex-col items-end gap-1">
                {onSelect && (
                  <button
                    type="button"
                    onClick={onSelect}
                    title={selected ? "Remove from your day-by-day plan" : "Add to your day-by-day plan"}
                    className={`flex items-center gap-1 rounded-md px-2 py-1 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      selected ? "bg-brand-600 text-white" : "border border-brand-400 bg-brand-50 text-brand-700 hover:bg-brand-100 hover:border-brand-500"
                    }`}
                  >
                    {selected ? <Check size={10} /> : null}
                    {selected ? "In Itinerary" : "Add to Itinerary"}
                  </button>
                )}
                {onSave && (
                  <button
                    type="button"
                    onClick={onSave}
                    disabled={saved}
                    title={saved ? "Saved to Wanderlog — your save-for-later list" : "Save to Wanderlog — keep it without scheduling it"}
                    className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                      saved ? "text-brand-600" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                    }`}
                  >
                    <Heart size={10} className={saved ? "fill-brand-600" : undefined} />
                    {saved ? "Saved" : "Add to Wanderlog"}
                  </button>
                )}
              </div>
              <p className="text-xs font-medium text-sage-700">{r.rating}/10</p>
            </div>
          </div>

          {r.mustOrder && (
            <p className="mt-1.5 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 leading-snug truncate">
              🍴 {r.mustOrder}
            </p>
          )}
          {r.beliNote && (
            <p className="mt-1 text-[11px] text-brand-600 bg-brand-50 rounded px-2 py-1 leading-snug">
              📍 {r.beliNote}
            </p>
          )}

          <div className="flex items-center gap-3 mt-2">
            {r.menuUrl && (
              <a href={r.menuUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 hover:underline">
                Menu <ExternalLink size={9} />
              </a>
            )}
            <a
              href={`https://www.google.com/maps/search/${encodeURIComponent(r.name + " " + r.location)}`}
              target="_blank" rel="noreferrer"
              className="flex items-center gap-0.5 text-[11px] text-slate-500 hover:text-slate-700 hover:underline">
              Map <ExternalLink size={9} />
            </a>
            {r.bookingUrl && (
              <a href={r.bookingUrl} target="_blank" rel="noreferrer"
                className="flex items-center gap-0.5 text-[11px] text-brand-500 font-medium hover:underline ml-auto">
                {r.tier === "fine_dining" || r.tier === "upscale" ? "Reserve" : "Find it"} <ExternalLink size={9} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ActivityCard({
  activity,
  saved = false,
  onSave,
  selected = false,
  onSelect,
}: {
  activity: ActivityOption;
  saved?: boolean;
  onSave?: () => void;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const { trip } = useTripStore();
  return (
    <Card padding="sm" selected={selected}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <p className="font-medium text-slate-800 text-sm">{activity.name}</p>
            {activity.isLocalFavorite && <Badge variant="success">Local pick</Badge>}
          </div>
          <p className="text-xs text-slate-500 mt-1">{activity.description}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
            <span>⏱ {activity.duration}</span>
            <span>⭐ {activity.rating}{activity.ratingSource ? ` (${activity.ratingSource})` : ""}</span>
          </div>
        </div>
        <div className="text-right shrink-0 flex flex-col items-end gap-1.5">
          <div className="flex flex-col items-end gap-1">
            {onSelect && (
              <button
                type="button"
                onClick={onSelect}
                title={selected ? "Remove from your day-by-day plan" : "Add to your day-by-day plan"}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  selected ? "bg-brand-600 text-white" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                {selected ? <Check size={10} /> : null}
                {selected ? "In Itinerary" : "Add to Itinerary"}
              </button>
            )}
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saved}
                title={saved ? "Saved to Wanderlog — your save-for-later list" : "Save to Wanderlog — keep it without scheduling it"}
                className={`flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap transition-colors ${
                  saved ? "text-brand-600" : "border border-slate-200 text-slate-500 hover:border-brand-300 hover:text-brand-600"
                }`}
              >
                <Heart size={10} className={saved ? "fill-brand-600" : undefined} />
                {saved ? "Saved" : "Add to Wanderlog"}
              </button>
            )}
          </div>
          <div>
            <p className="font-bold text-slate-900 text-sm">{formatCurrency(activity.price, trip.preferences.preferredCurrency)}</p>
            {activity.bookingUrl && (
              <a href={activity.bookingUrl} target="_blank" rel="noreferrer"
                className="text-xs text-brand-500 hover:underline flex items-center gap-0.5 justify-end mt-0.5">
                Book <ExternalLink size={10} />
              </a>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
