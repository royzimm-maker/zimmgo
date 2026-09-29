"use client";

// The draggable activity/restaurant cards and drop zones of the Refine
// step's schedule board.
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { X, Heart } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import type { ActivityOption, RestaurantOption } from "@/types/trip";
// ─── Emoji lookups ────────────────────────────────────────────────────────────

const ACTIVITY_EMOJI: Record<string, string> = {
  skiing: "⛷️", hiking: "🥾", sailing: "⛵", food: "🍽️", diving: "🤿",
  cycling: "🚴", cultural: "🏛️", photography: "📸", wellness: "🧘",
  adventure: "🧗", guided_walking_tour: "🚶",
};

const RESTAURANT_EMOJI: Record<string, string> = {
  fine_dining: "⭐", upscale: "🥂", midrange: "🍽️",
  casual: "🍴", street_food: "🥙", brunch: "🥞",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CardInfo {
  cardId: string;
  kind: "activity" | "restaurant";
  activity?: ActivityOption;
  restaurant?: RestaurantOption;
}

// ─── CardInner — shared between DraggableCard and DragOverlay ─────────────────

export function CardInner({
  info,
  onRemove,
  onSave,
  overlay = false,
}: {
  info: CardInfo;
  onRemove?: () => void;
  onSave?: () => void;
  overlay?: boolean;
}) {
  const { activity, restaurant } = info;
  const { trip } = useTripStore();

  const base = overlay
    ? "flex items-center gap-2 rounded-lg border px-2.5 py-2 shadow-2xl ring-2 select-none"
    : "flex items-center gap-2 rounded-lg border px-2.5 py-2 shadow-sm hover:shadow-md transition-shadow select-none cursor-grab";

  if (activity) {
    const emoji = ACTIVITY_EMOJI[activity.category] ?? "🎯";
    return (
      <div className={`${base} ${overlay ? "border-brand-300 bg-white ring-brand-200" : "border-slate-200 bg-white"}`}>
        <span className="text-sm shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{activity.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {activity.location && <span className="font-medium text-brand-600 truncate">{activity.location}</span>}
            {activity.duration && <span>{activity.duration}</span>}
            {activity.price > 0 && <span>{formatCurrency(activity.price, trip.preferences.preferredCurrency)}</span>}
          </div>
        </div>
        {onSave && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="shrink-0 text-slate-300 hover:text-brand-500 transition-colors"
            title="Save to Wanderlog instead"
          >
            <Heart size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            title="Return to bank"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  if (restaurant) {
    const emoji = RESTAURANT_EMOJI[restaurant.tier] ?? "🍽️";
    return (
      <div className={`${base} ${overlay ? "border-amber-300 bg-amber-50 ring-amber-200" : "border-amber-200 bg-amber-50/60"}`}>
        <span className="text-sm shrink-0">{emoji}</span>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-800 truncate leading-tight">{restaurant.name}</p>
          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400">
            {restaurant.location && <span className="font-medium text-amber-700 truncate">{restaurant.location}</span>}
            <span>{restaurant.cuisine}</span>
            <span className="font-medium text-amber-600">{restaurant.priceRange}</span>
          </div>
        </div>
        {onSave && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onSave(); }}
            className="shrink-0 text-slate-300 hover:text-brand-500 transition-colors"
            title="Save to Wanderlog instead"
          >
            <Heart size={12} />
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="shrink-0 text-slate-300 hover:text-red-400 transition-colors"
            title="Return to bank"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  return null;
}

// ─── DraggableCard ────────────────────────────────────────────────────────────

export function DraggableCard({ info, onRemove, onSave }: { info: CardInfo; onRemove?: () => void; onSave?: () => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: info.cardId });
  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{ opacity: isDragging ? 0.15 : 1, touchAction: "none" }}
    >
      <CardInner info={info} onRemove={onRemove} onSave={onSave} />
    </div>
  );
}

// ─── DroppableContainer ───────────────────────────────────────────────────────

export function DroppableContainer({
  id,
  isEmpty,
  compatible = true,
  children,
}: {
  id: string;
  isEmpty: boolean;
  compatible?: boolean;
  children: React.ReactNode;
}) {
  const { isOver, setNodeRef } = useDroppable({ id });
  const blocked = isOver && !compatible;
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[52px] rounded-lg transition-all duration-100 ${
        blocked
          ? "ring-2 ring-red-300 ring-inset bg-red-50"
          : isOver && compatible
          ? "ring-2 ring-brand-400 ring-inset bg-brand-50"
          : isEmpty
          ? "border-2 border-dashed border-slate-200"
          : ""
      } p-1.5`}
    >
      {isEmpty ? (
        <p className={`text-[11px] text-center py-2.5 ${
          blocked ? "text-red-400 font-medium" :
          isOver && compatible ? "text-brand-500 font-medium" :
          "text-slate-400"
        }`}>
          {blocked ? "Wrong location" : isOver && compatible ? "Release to add" : "Drop here"}
        </p>
      ) : (
        <div className="flex flex-col gap-1.5">{children}</div>
      )}
    </div>
  );
}
