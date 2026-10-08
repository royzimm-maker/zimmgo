"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import { SCHEMA_VERSION, MAX_CHAT_MESSAGES, migratePersistedState } from "@/lib/sync/schema";
import { safeLocalStorage } from "@/lib/store/safeStorage";
import { carryOverSelections, cityForHotel } from "@/lib/planning/selections";
import { applyPreferenceUpdate, type PreferenceUpdate } from "@/lib/planning/preferenceUpdates";
import { itineraryCities } from "@/lib/location";
import type {
  Trip,
  StepId,
  GeneratedItinerary,
  ItineraryRefinements,
  FinalizedPlan,
  ItinerarySelections,
  ChatMessage,
  Destination,
  DatePreference,
  HotelOption,
  FlightOption,
  RestaurantOption,
  ActivityOption,
  TransportOption,
  LodgingPreference,
  AirlinePreference,
  ActivityCategory,
  VibeTag,
  TransportMode,
  BudgetRange,
  SplurgePreference,
  WanderlogItem,
  ReviewSourcePreference,
  BeliPreference,
  SchedulePace,
} from "@/types/trip";

// ─── State shape ───────────────────────────────────────────────────────────────
interface TripState {
  trip: Trip;
  // Other trips the user has started but isn't actively working on right now.
  // The active trip always lives in `trip`; switching moves it in and out of
  // this list so only one Trip object is ever "live" at a time.
  savedTrips: Trip[];
  chatMessages: ChatMessage[];
  isGenerating: boolean;   // AI is currently producing output
  sidebarOpen: boolean;

  // Trip-level actions
  resetTrip: () => void;
  setTripName: (name: string) => void;
  startNewTrip: () => void;
  switchToTrip: (tripId: string) => void;
  deleteTrip: (tripId: string) => void;

  // Step navigation
  goToStep: (step: StepId) => void;
  completeStep: (step: StepId) => void;
  uncompleteStep: (step: StepId) => void;

  // Individual preference setters
  setDestination: (dest: Destination) => void;
  setActivities: (activities: (ActivityCategory | string)[]) => void;
  setVibes: (vibes: (VibeTag | string)[]) => void;
  /** Apply a preference change ZiGy made from chat. */
  applyPreferenceUpdate: (update: PreferenceUpdate) => void;
  setSchedulePace: (pace: SchedulePace | undefined) => void;
  setAutoPlanEverything: (value: boolean) => void;
  setSelectedActivityIds: (ids: string[]) => void;
  setSelectedRestaurantIds: (ids: string[]) => void;
  setDates: (dates: DatePreference) => void;
  setBudget: (ranges: BudgetRange[]) => void;
  setBudgetDetails: (details: {
    travelers?: number;
    rooms?: number;
    dailyFoodBudgetPerPerson?: number;
    customBudgetRange?: { min: number; max: number };
    splurge?: SplurgePreference;
  }) => void;
  setLodging: (lodging: LodgingPreference) => void;
  setReviewSourcePref: (pref: ReviewSourcePreference) => void;
  setBeliPref: (pref: BeliPreference) => void;
  setSelectedHotelForCity: (city: string, hotel: HotelOption | null) => void;
  setLodgingPick: (hotel: HotelOption | null) => void;
  setSelectedTransportForLeg: (city: string, option: TransportOption | null) => void;
  setAutoPickHotels: (value: boolean) => void;
  setSelectedFlight: (flight: import("@/types/trip").FlightOption | null) => void;
  toggleSelectedRestaurant: (id: string) => void;
  toggleSelectedActivity: (id: string) => void;
  setAirlines: (prefs: AirlinePreference) => void;
  setNoFlightsNeeded: (value: boolean) => void;
  setPreferredCurrency: (code: string | undefined) => void;
  setDietaryRestrictions: (restrictions: string[], notes: string | undefined) => void;
  setAvoidLongQueues: (value: boolean) => void;
  setDayTripRequested: (value: boolean) => void;
  setCityNights: (nights: Record<string, number> | undefined) => void;
  setVisaAcknowledged: (value: boolean) => void;
  setTransportation: (modes: TransportMode[]) => void;

  // Itinerary
  addItinerary: (itinerary: GeneratedItinerary) => void;
  setItineraryFlights: (itineraryId: string, flights: FlightOption[]) => void;
  /** Swaps in updated copies of restaurants or activities, matched by id (e.g. refreshed Google places). */
  replaceRestaurants: (itineraryId: string, updated: RestaurantOption[]) => void;
  replaceActivities: (itineraryId: string, updated: ActivityOption[]) => void;
  /** Hotels live in three places — the itinerary's list, each city's chosen hotel, and the Lodging pick; all are updated. */
  replaceHotels: (itineraryId: string | null, updated: HotelOption[]) => void;
  updateItineraryRefinements: (itineraryId: string, refinements: ItineraryRefinements) => void;
  saveFinalizedPlan: (itineraryId: string, plan: FinalizedPlan) => void;
  markItineraryReviewed: (itineraryId: string) => void;
  addWanderlogItem: (itineraryId: string, item: Omit<WanderlogItem, "id" | "addedAt">) => void;
  removeWanderlogItem: (itineraryId: string, itemId: string) => void;
  updateWanderlogNote: (itineraryId: string, itemId: string, note: string) => void;

  // Chat
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;

  // UI
  setGenerating: (val: boolean) => void;
  setSidebarOpen: (val: boolean) => void;

  // User-level default (persists across trips, unlike trip.preferences)
  defaultDepartureAirport?: string;
  setDefaultDepartureAirport: (airport: string | undefined) => void;
  // Same idea for Beli — connecting is a one-time account link, not a
  // per-trip preference, so it shouldn't have to be redone every trip.
  defaultBeliPref?: BeliPreference;
  // Same idea for currency — once a traveller picks a display currency it
  // should stick around for their next trip too.
  defaultCurrency?: string;
}

// ─── Initial values ────────────────────────────────────────────────────────────
function makeEmptyTrip(): Trip {
  const now = new Date().toISOString();
  return {
    id: uuid(),
    name: "My Trip",
    preferences: {
      activities: [],
      activityRankings: {},
      vibes: [],
      transportation: [],
    },
    currentStep: "destination",
    completedSteps: [],
    itineraries: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ─── Store ─────────────────────────────────────────────────────────────────────
// A trip only counts as "worth keeping" once the user has put real
// information into it — an untouched blank trip shouldn't clutter the trip
// switcher or silently survive as a phantom entry.
export function hasRealProgress(trip: Trip): boolean {
  return (
    trip.completedSteps.length > 0 ||
    trip.itineraries.length > 0 ||
    !!trip.preferences.destination
  );
}

// ── Selections ──
// The traveller's choices belong to the itinerary they're about
// (GeneratedItinerary.selections). The selection setters act on the latest
// itinerary — the one being reviewed and shown; with none, they do nothing.
// The list with any item that has an updated copy swapped for it, in place.
function replacedById<T extends { id: string }>(items: T[], updated: T[]): T[] {
  const byId = new Map(updated.map((x) => [x.id, x]));
  return items.map((x) => byId.get(x.id) ?? x);
}

// Applies `change` to one itinerary of the current trip.
function withItinerary(s: TripState, itineraryId: string, change: (it: GeneratedItinerary) => GeneratedItinerary): Partial<TripState> {
  return {
    trip: {
      ...s.trip,
      itineraries: s.trip.itineraries.map((it) => (it.id === itineraryId ? change(it) : it)),
      updatedAt: new Date().toISOString(),
    },
  };
}

function withLatestSelections(
  s: Pick<TripState, "trip">,
  change: (selections: ItinerarySelections) => ItinerarySelections
): Partial<TripState> {
  const itineraries = s.trip.itineraries;
  const latest = itineraries[itineraries.length - 1];
  if (!latest) return {};
  return {
    trip: {
      ...s.trip,
      itineraries: [...itineraries.slice(0, -1), { ...latest, selections: change(latest.selections ?? {}) }],
      updatedAt: new Date().toISOString(),
    },
  };
}

function withEntry<T>(map: Record<string, T> | undefined, key: string, value: T | null): Record<string, T> {
  const next = { ...(map ?? {}) };
  if (value) next[key] = value;
  else delete next[key];
  return next;
}

const toggled = (ids: string[] | undefined, id: string) =>
  (ids ?? []).includes(id) ? (ids ?? []).filter((x) => x !== id) : [...(ids ?? []), id];

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trip: makeEmptyTrip(),
      savedTrips: [],
      chatMessages: [],
      isGenerating: false,
      sidebarOpen: false,

      resetTrip: () =>
        set({ trip: makeEmptyTrip(), chatMessages: [] }),

      setTripName: (name) =>
        set((s) => ({
          trip: { ...s.trip, name, updatedAt: new Date().toISOString() },
        })),

      startNewTrip: () =>
        set((s) => {
          const rest = s.savedTrips.filter((t) => t.id !== s.trip.id);
          const savedTrips = hasRealProgress(s.trip) ? [s.trip, ...rest] : rest;
          return { trip: makeEmptyTrip(), chatMessages: [], savedTrips };
        }),

      switchToTrip: (tripId) =>
        set((s) => {
          if (tripId === s.trip.id) return {};
          const target = s.savedTrips.find((t) => t.id === tripId);
          if (!target) return {};
          const rest = s.savedTrips.filter((t) => t.id !== tripId);
          const savedTrips = hasRealProgress(s.trip) ? [s.trip, ...rest] : rest;
          return {
            trip: target,
            savedTrips,
            chatMessages: [],
          };
        }),

      deleteTrip: (tripId) =>
        set((s) => {
          if (tripId === s.trip.id) {
            return { trip: makeEmptyTrip(), chatMessages: [] };
          }
          return { savedTrips: s.savedTrips.filter((t) => t.id !== tripId) };
        }),

      goToStep: (step) =>
        set((s) => ({
          trip: {
            ...s.trip,
            currentStep: step,
            updatedAt: new Date().toISOString(),
          },
        })),

      completeStep: (step) =>
        set((s) => {
          const completed = Array.from(
            new Set([...s.trip.completedSteps, step])
          ) as StepId[];
          return {
            trip: {
              ...s.trip,
              completedSteps: completed,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      uncompleteStep: (step) =>
        set((s) => {
          const completed = s.trip.completedSteps.filter((s) => s !== step);
          return {
            trip: {
              ...s.trip,
              completedSteps: completed,
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setDestination: (destination) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, destination },
            updatedAt: new Date().toISOString(),
          },
        })),

      setActivities: (activities) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, activities },
            updatedAt: new Date().toISOString(),
          },
        })),

      setVibes: (vibes) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, vibes },
            updatedAt: new Date().toISOString(),
          },
        })),

      applyPreferenceUpdate: (update) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, ...applyPreferenceUpdate(s.trip.preferences, update) },
            updatedAt: new Date().toISOString(),
          },
        })),

      setSchedulePace: (schedulePace) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, schedulePace },
            updatedAt: new Date().toISOString(),
          },
        })),

      setAutoPlanEverything: (autoPlanEverything) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, autoPlanEverything },
            updatedAt: new Date().toISOString(),
          },
        })),

      setSelectedActivityIds: (activityIds) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, activityIds }))),

      setSelectedRestaurantIds: (restaurantIds) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, restaurantIds }))),

      setDates: (dates) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, dates },
            updatedAt: new Date().toISOString(),
          },
        })),

      setBudget: (budgetRanges) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, budgetRanges },
            updatedAt: new Date().toISOString(),
          },
        })),

      setBudgetDetails: (details) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, ...details },
            updatedAt: new Date().toISOString(),
          },
        })),

      setLodging: (lodging) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, lodging },
            updatedAt: new Date().toISOString(),
          },
        })),

      setReviewSourcePref: (reviewSourcePref) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, reviewSourcePref },
            updatedAt: new Date().toISOString(),
          },
        })),

      // Also updates the remembered default so the next trip starts already
      // connected — a Beli account link isn't something worth re-entering
      // per trip, unlike trip-scoped preferences.
      setBeliPref: (beliPref) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, beliPref },
            updatedAt: new Date().toISOString(),
          },
          defaultBeliPref: beliPref,
        })),

      setSelectedHotelForCity: (city, hotel) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, hotelsByCity: withEntry(sel.hotelsByCity, city, hotel) }))),

      // The Lodging step's pick, made before there's an itinerary. It's kept
      // as a preference (a new itinerary's choice for that city starts from
      // it) and, if an itinerary already exists, also becomes its choice for
      // that city — so the most recent decision is the one every screen shows.
      setLodgingPick: (hotel) =>
        set((s) => {
          const trip = { ...s.trip, preferences: { ...s.trip.preferences, lodgingPick: hotel ?? undefined } };
          const latest = trip.itineraries[trip.itineraries.length - 1];
          if (!latest) return { trip: { ...trip, updatedAt: new Date().toISOString() } };
          const city = hotel ? cityForHotel(hotel, itineraryCities(latest, trip.preferences.destination)) : undefined;
          if (!city) return { trip: { ...trip, updatedAt: new Date().toISOString() } };
          return withLatestSelections({ trip }, (sel) => ({ ...sel, hotelsByCity: withEntry(sel.hotelsByCity, city, hotel) }));
        }),

      setSelectedTransportForLeg: (city, option) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, transportByLeg: withEntry(sel.transportByLeg, city, option) }))),

      setAutoPickHotels: (autoPickHotels) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, autoPickHotels },
            updatedAt: new Date().toISOString(),
          },
        })),

      setSelectedFlight: (flight) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, flight: flight ?? undefined }))),

      toggleSelectedRestaurant: (id) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, restaurantIds: toggled(sel.restaurantIds, id) }))),

      toggleSelectedActivity: (id) =>
        set((s) => withLatestSelections(s, (sel) => ({ ...sel, activityIds: toggled(sel.activityIds, id) }))),

      setAirlines: (airlinePrefs) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, airlinePrefs },
            updatedAt: new Date().toISOString(),
          },
        })),

      setNoFlightsNeeded: (noFlightsNeeded) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, noFlightsNeeded },
            updatedAt: new Date().toISOString(),
          },
        })),

      // Also updates the remembered default, same pattern as setBeliPref —
      // a currency choice should stick for the traveller's next trip too.
      setPreferredCurrency: (preferredCurrency) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, preferredCurrency },
            updatedAt: new Date().toISOString(),
          },
          defaultCurrency: preferredCurrency,
        })),

      setDietaryRestrictions: (dietaryRestrictions, dietaryNotes) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, dietaryRestrictions, dietaryNotes },
            updatedAt: new Date().toISOString(),
          },
        })),

      setAvoidLongQueues: (avoidLongQueues) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, avoidLongQueues },
            updatedAt: new Date().toISOString(),
          },
        })),

      setDayTripRequested: (dayTripRequested) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, dayTripRequested },
            updatedAt: new Date().toISOString(),
          },
        })),

      setVisaAcknowledged: (visaAcknowledged) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, visaAcknowledged },
            updatedAt: new Date().toISOString(),
          },
        })),

      setCityNights: (cityNights) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, cityNights },
            updatedAt: new Date().toISOString(),
          },
        })),

      setTransportation: (transportation) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, transportation },
            updatedAt: new Date().toISOString(),
          },
        })),

      addItinerary: (itinerary) =>
        set((s) => {
          // Choices from the previous itinerary that still apply carry over,
          // plus the Lodging step's pick (lib/planning/selections.ts).
          const previous = s.trip.itineraries[s.trip.itineraries.length - 1];
          const selections = itinerary.selections
            ?? carryOverSelections(previous?.selections, s.trip.preferences.lodgingPick, itinerary, s.trip.preferences.destination);
          return {
            trip: {
              ...s.trip,
              // Replaces rather than appends: only the latest itinerary is ever
              // shown or edited, and keeping every regeneration made the saved
              // trip grow without bound (see lib/sync/schema.ts MIGRATIONS[1]).
              itineraries: [{ ...itinerary, selections }],
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      // Used by the manual "search flights" fallback in the review wizard,
      // for itineraries generated without any (e.g. search_flights came back
      // empty, or the AI skipped the call) — lets the traveller retry the
      // search themselves instead of being stuck with no flight options ever.
      setItineraryFlights: (itineraryId, flights) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId ? { ...it, flights } : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      replaceRestaurants: (itineraryId, updated) =>
        set((s) => withItinerary(s, itineraryId, (it) => (it.restaurants ? { ...it, restaurants: replacedById(it.restaurants, updated) } : it))),

      replaceActivities: (itineraryId, updated) =>
        set((s) => withItinerary(s, itineraryId, (it) => ({ ...it, activities: replacedById(it.activities, updated) }))),

      replaceHotels: (itineraryId, updated) =>
        set((s) => {
          const byId = new Map(updated.map((h) => [h.id, h]));
          const pick = s.trip.preferences.lodgingPick;
          const withPick = { ...s, trip: { ...s.trip, preferences: { ...s.trip.preferences, lodgingPick: (pick && byId.get(pick.id)) ?? pick } } };
          if (!itineraryId) return { trip: { ...withPick.trip, updatedAt: new Date().toISOString() } };
          return withItinerary(withPick, itineraryId, (it) => {
            const chosen = it.selections?.hotelsByCity;
            return {
              ...it,
              hotels: replacedById(it.hotels, updated),
              ...(chosen ? { selections: { ...it.selections, hotelsByCity: Object.fromEntries(Object.entries(chosen).map(([city, h]) => [city, byId.get(h.id) ?? h])) } } : {}),
            };
          });
        }),

      updateItineraryRefinements: (itineraryId, refinements) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId ? { ...it, refinements } : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      saveFinalizedPlan: (itineraryId, plan) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId ? { ...it, finalizedPlan: plan } : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      markItineraryReviewed: (itineraryId) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId ? { ...it, reviewCompleted: true } : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      addWanderlogItem: (itineraryId, item) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId
                ? { ...it, wanderlog: [...(it.wanderlog ?? []), { ...item, id: uuid(), addedAt: new Date().toISOString() }] }
                : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      removeWanderlogItem: (itineraryId, itemId) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId
                ? { ...it, wanderlog: (it.wanderlog ?? []).filter((w) => w.id !== itemId) }
                : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      updateWanderlogNote: (itineraryId, itemId, note) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId
                ? { ...it, wanderlog: (it.wanderlog ?? []).map((w) => (w.id === itemId ? { ...w, note } : w)) }
                : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      addMessage: (msg) =>
        set((s) => ({
          // Only the recent conversation is useful (the chat route sends the
          // last 12 to the model); older messages just grow the saved blob.
          chatMessages: [
            ...s.chatMessages,
            { ...msg, id: uuid(), createdAt: new Date().toISOString() },
          ].slice(-MAX_CHAT_MESSAGES),
        })),

      clearMessages: () => set({ chatMessages: [] }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      defaultDepartureAirport: undefined,
      setDefaultDepartureAirport: (defaultDepartureAirport) => set({ defaultDepartureAirport }),
      defaultBeliPref: undefined,
      defaultCurrency: undefined,
    }),
    {
      name: "zimmgo-trip",
      // persist writes synchronously inside every state update, so a raw
      // localStorage that throws when full would make every store action
      // throw. This one fails soft: state stays in memory and keeps syncing
      // to the server.
      storage: createJSONStorage(() => safeLocalStorage),
      // Saved state older than SCHEMA_VERSION is upgraded on load (see
      // lib/sync/schema.ts) instead of being handed to code that expects the
      // current shape. Bump it there, not here.
      version: SCHEMA_VERSION,
      migrate: (persisted, version) => migratePersistedState(persisted, version) as unknown as TripState,
      // isGenerating and sidebarOpen are transient UI state — never persist them
      partialize: (state) => ({
        trip: state.trip,
        savedTrips: state.savedTrips,
        chatMessages: state.chatMessages,
        // Deliberately survives resetTrip() — a new trip should still default
        // to the airport the user flies from most, unlike trip-scoped prefs.
        defaultDepartureAirport: state.defaultDepartureAirport,
        defaultBeliPref: state.defaultBeliPref,
        defaultCurrency: state.defaultCurrency,
      }),
    }
  )
);
