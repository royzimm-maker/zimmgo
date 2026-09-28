import { calcProgress } from "@/types/trip";
import type { Trip, ChatMessage, BeliPreference } from "@/types/trip";

// The exact shape tripStore.ts's own `partialize` persists to localStorage —
// the whole sync payload, in both directions.
export interface SyncBlob {
  trip: Trip;
  savedTrips: Trip[];
  chatMessages: ChatMessage[];
  progress: number;
  defaultDepartureAirport?: string;
  defaultBeliPref?: BeliPreference;
  defaultCurrency?: string;
}

// Shallow structural check, not full validation — enough to refuse garbage
// on the server and to never hydrate the store from a malformed blob.
function isTrip(t: unknown): t is Trip {
  if (!t || typeof t !== "object") return false;
  const x = t as Record<string, unknown>;
  return (
    typeof x.id === "string" &&
    typeof x.updatedAt === "string" &&
    !!x.preferences && typeof x.preferences === "object" &&
    Array.isArray(x.itineraries) &&
    Array.isArray(x.completedSteps)
  );
}

export function isSyncBlob(b: unknown): b is SyncBlob {
  if (!b || typeof b !== "object") return false;
  const x = b as Record<string, unknown>;
  return (
    isTrip(x.trip) &&
    Array.isArray(x.savedTrips) && x.savedTrips.every(isTrip) &&
    Array.isArray(x.chatMessages) &&
    typeof x.progress === "number"
  );
}

// Key-order-independent serialization for equality checks — Postgres jsonb
// reorders object keys, so a blob round-tripped through the server never
// JSON.stringify-matches the local copy even when the content is identical.
export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function ts(t: Trip): number {
  return Date.parse(t.updatedAt) || 0;
}

export function newestUpdatedAt(blob: Pick<SyncBlob, "trip" | "savedTrips">): number {
  return [blob.trip, ...blob.savedTrips].reduce((max, t) => Math.max(max, ts(t)), 0);
}

// Resolves a write conflict (another tab saved first) trip by trip rather
// than letting one whole blob clobber the other: for each trip id, the copy
// with the newer updatedAt wins, so an edit to trip A in one tab and trip B
// in another both survive. The active trip stays whichever one this tab has
// open; chat and device defaults stay local. Known limitation: a trip deleted
// in one tab is resurrected by the other's copy — there are no tombstones.
export function mergeSyncBlobs(local: SyncBlob, server: SyncBlob): SyncBlob {
  const byId = new Map<string, Trip>();
  // Local first with a strict ">" so ties keep the local copy — avoids
  // churning the store over identical content.
  for (const t of [local.trip, ...local.savedTrips, server.trip, ...server.savedTrips]) {
    const existing = byId.get(t.id);
    if (!existing || ts(t) > ts(existing)) byId.set(t.id, t);
  }

  const active = byId.get(local.trip.id)!;
  const order = [...local.savedTrips, server.trip, ...server.savedTrips].map((t) => t.id);
  const savedIds = Array.from(new Set(order)).filter((id) => id !== active.id);

  return {
    trip: active,
    savedTrips: savedIds.map((id) => byId.get(id)!),
    chatMessages: local.chatMessages,
    progress: calcProgress(active.completedSteps),
    defaultDepartureAirport: local.defaultDepartureAirport ?? server.defaultDepartureAirport,
    defaultBeliPref: local.defaultBeliPref ?? server.defaultBeliPref,
    defaultCurrency: local.defaultCurrency ?? server.defaultCurrency,
  };
}
