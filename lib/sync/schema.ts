import { ORDERED_STEPS, calcProgress } from "@/types/trip";
import { isSyncBlob, type SyncBlob } from "@/lib/sync/syncBlob";
import { itineraryCities, resolveCity } from "@/lib/location";

// Versioning for everything the app persists: the localStorage store
// (zustand `persist`, key "zimmgo-trip") and the device blob synced to the
// server. Both hold the same shape, so they share one version number and one
// migration path.
//
// When a change to types/trip.ts would break already-saved data (a renamed
// or restructured field, a removed step, a new required field):
//   1. bump SCHEMA_VERSION,
//   2. add MIGRATIONS[old] that rewrites old-shaped state to the new shape,
//   3. extend normalizeTrip if the new field needs a safe default.
// Old data is then upgraded when a browser loads it, when a synced copy is
// pulled from the server, and when an older tab pushes to the server.
export const SCHEMA_VERSION = 3;

// Chat history kept per device — the chat route only sends the last 12.
export const MAX_CHAT_MESSAGES = 100;

type Loose = Record<string, unknown>;

// MIGRATIONS[n] upgrades state from version n to n + 1. Runs before
// normalization, so it only needs to handle what actually changed.
const MIGRATIONS: Record<number, (state: Loose) => Loose> = {
  // 0 → 1: the baseline. Everything saved before versioning existed is
  // version 0 and may predate fields added since — normalization below fills
  // those in, so there's nothing to rename.
  0: (state) => state,
  // 1 → 2: bounded growth. Every regeneration used to be appended to the
  // trip though only the latest is ever used, and chat history was
  // unbounded — together enough to push the synced blob past its size limit.
  // Keep each trip's latest itinerary and the most recent chat.
  1: (state) => {
    const latestOnly = (t: unknown) =>
      isObj(t) && Array.isArray(t.itineraries) ? { ...t, itineraries: t.itineraries.slice(-1) } : t;
    return {
      ...state,
      trip: latestOnly(state.trip),
      savedTrips: arr(state.savedTrips).map(latestOnly),
      chatMessages: arr(state.chatMessages).slice(-MAX_CHAT_MESSAGES),
    };
  },
  // 2 → 3: one place for hotel choices. The Lodging step's single
  // `selectedHotel` moves into `selectedHotelsByCity`, under the itinerary
  // city it belongs to (the first city if it can't be placed). A per-city
  // choice already there wins — it was made later, in the review.
  2: (state) => {
    const moveSingleHotelPick = (t: unknown) => {
      if (!isObj(t) || !isObj(t.preferences) || !isObj(t.preferences.selectedHotel)) return t;
      const { selectedHotel, ...preferences } = t.preferences;
      const hotel = selectedHotel as Loose;
      const itineraries = arr(t.itineraries).filter(isObj) as { days: { location?: string }[] }[];
      const cities = itineraryCities(
        itineraries.length ? { days: arr(itineraries[itineraries.length - 1].days) as { location?: string }[] } : null,
        isObj(preferences.destination) ? (preferences.destination as { cities?: string[]; displayName?: string }) : undefined
      );
      const city = resolveCity(String(hotel.city ?? hotel.location ?? ""), cities) ?? cities[0];
      const byCity = isObj(preferences.selectedHotelsByCity) ? { ...preferences.selectedHotelsByCity } : {};
      if (city && !byCity[city]) byCity[city] = hotel;
      return { ...t, preferences: { ...preferences, selectedHotelsByCity: byCity } };
    };
    return { ...state, trip: moveSingleHotelPick(state.trip), savedTrips: arr(state.savedTrips).map(moveSingleHotelPick) };
  },
};

const isObj = (v: unknown): v is Loose => !!v && typeof v === "object" && !Array.isArray(v);
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const KNOWN_STEPS = new Set<string>(ORDERED_STEPS);
// Missing timestamps sort as oldest, so a repaired trip never wins a sync
// merge over a real edit.
const EPOCH = new Date(0).toISOString();

function normalizeItinerary(it: Loose): Loose {
  return {
    ...it,
    days: arr(it.days),
    flights: arr(it.flights),
    hotels: arr(it.hotels),
    activities: arr(it.activities),
  };
}

// Repairs a trip to the current shape: fills required fields that older data
// may lack and drops step ids that no longer exist. Returns null for data
// that isn't recognizably a trip.
function normalizeTrip(raw: unknown): Loose | null {
  if (!isObj(raw) || typeof raw.id !== "string" || !raw.id) return null;
  const prefs = isObj(raw.preferences) ? raw.preferences : {};
  return {
    ...raw,
    name: typeof raw.name === "string" ? raw.name : "My trip",
    preferences: {
      ...prefs,
      activities: arr(prefs.activities),
      activityRankings: isObj(prefs.activityRankings) ? prefs.activityRankings : {},
      vibes: arr(prefs.vibes),
      transportation: arr(prefs.transportation),
    },
    currentStep: typeof raw.currentStep === "string" && KNOWN_STEPS.has(raw.currentStep) ? raw.currentStep : ORDERED_STEPS[0],
    completedSteps: arr(raw.completedSteps).filter((s) => typeof s === "string" && KNOWN_STEPS.has(s)),
    itineraries: arr(raw.itineraries).filter(isObj).map(normalizeItinerary),
    createdAt: typeof raw.createdAt === "string" ? raw.createdAt : EPOCH,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : EPOCH,
  };
}

function normalizeState(state: Loose): Loose {
  const savedTrips = arr(state.savedTrips).map(normalizeTrip).filter((t): t is Loose => t !== null);
  const trip = normalizeTrip(state.trip);
  const next: Loose = { ...state };
  // An unreadable active trip is left out entirely, so the store keeps its
  // fresh default trip rather than crashing on garbage.
  if (trip) next.trip = trip;
  else delete next.trip;
  return {
    ...next,
    savedTrips,
    chatMessages: arr(state.chatMessages).filter(isObj),
    progress: trip ? calcProgress(trip.completedSteps as never) : 0,
  };
}

// Upgrades persisted state from `fromVersion` to SCHEMA_VERSION. State from a
// newer version (written by newer code, e.g. before a rollback) is returned
// untouched rather than guessed at — it's never downgraded or discarded.
export function migratePersistedState(persisted: unknown, fromVersion: number): Loose {
  if (!isObj(persisted)) return {};
  if (fromVersion > SCHEMA_VERSION) return persisted;
  let state = persisted;
  for (let v = Math.max(0, fromVersion); v < SCHEMA_VERSION; v++) {
    state = MIGRATIONS[v]?.(state) ?? state;
  }
  return normalizeState(state);
}

export type MigrateResult =
  | { status: "ok"; blob: SyncBlob }
  // Written by newer code than this — must not be overwritten by it.
  | { status: "too-new"; schemaVersion: number }
  | { status: "invalid" };

// Brings a synced blob (from the server, or pushed by a client) up to the
// current version. A blob without `schemaVersion` predates versioning (v0).
export function migrateSyncBlob(raw: unknown): MigrateResult {
  if (!isObj(raw)) return { status: "invalid" };
  const from = typeof raw.schemaVersion === "number" && Number.isInteger(raw.schemaVersion) ? raw.schemaVersion : 0;
  if (from > SCHEMA_VERSION) return { status: "too-new", schemaVersion: from };
  const migrated = { ...migratePersistedState(raw, from), schemaVersion: SCHEMA_VERSION };
  return isSyncBlob(migrated) ? { status: "ok", blob: migrated } : { status: "invalid" };
}
