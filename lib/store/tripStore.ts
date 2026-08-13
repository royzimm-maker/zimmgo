"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import type {
  Trip,
  TripPreferences,
  StepId,
  GeneratedItinerary,
  ItineraryRefinements,
  FinalizedPlan,
  ChatMessage,
  Destination,
  DatePreference,
  HotelOption,
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
} from "@/types/trip";
import { calcProgress } from "@/types/trip";

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
  setVibes: (vibes: VibeTag[]) => void;
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
  setSelectedHotel: (hotel: HotelOption | null) => void;
  setSelectedHotelForCity: (city: string, hotel: HotelOption | null) => void;
  setSelectedFlight: (flight: import("@/types/trip").FlightOption | null) => void;
  toggleSelectedRestaurant: (id: string) => void;
  toggleSelectedActivity: (id: string) => void;
  setAirlines: (prefs: AirlinePreference) => void;
  setTransportation: (modes: TransportMode[]) => void;

  // Itinerary
  addItinerary: (itinerary: GeneratedItinerary) => void;
  updateItineraryRefinements: (itineraryId: string, refinements: ItineraryRefinements) => void;
  saveFinalizedPlan: (itineraryId: string, plan: FinalizedPlan) => void;
  markItineraryReviewed: (itineraryId: string) => void;
  addWanderlogItem: (itineraryId: string, item: Omit<WanderlogItem, "id" | "addedAt">) => void;
  removeWanderlogItem: (itineraryId: string, itemId: string) => void;
  updateWanderlogNote: (itineraryId: string, itemId: string, note: string) => void;
  updateWanderlogRating: (itineraryId: string, itemId: string, userRating: number | undefined) => void;

  // Chat
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;

  // UI
  setGenerating: (val: boolean) => void;
  setSidebarOpen: (val: boolean) => void;

  // Derived
  progress: number;

  // User-level default (persists across trips, unlike trip.preferences)
  defaultDepartureAirport?: string;
  setDefaultDepartureAirport: (airport: string | undefined) => void;
  // Same idea for Beli — connecting is a one-time account link, not a
  // per-trip preference, so it shouldn't have to be redone every trip.
  defaultBeliPref?: BeliPreference;
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
function hasRealProgress(trip: Trip): boolean {
  return (
    trip.completedSteps.length > 0 ||
    trip.itineraries.length > 0 ||
    !!trip.preferences.destination
  );
}

export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trip: makeEmptyTrip(),
      savedTrips: [],
      chatMessages: [],
      isGenerating: false,
      sidebarOpen: false,
      progress: 0,

      resetTrip: () =>
        set({ trip: makeEmptyTrip(), chatMessages: [], progress: 0 }),

      setTripName: (name) =>
        set((s) => ({
          trip: { ...s.trip, name, updatedAt: new Date().toISOString() },
        })),

      startNewTrip: () =>
        set((s) => {
          const rest = s.savedTrips.filter((t) => t.id !== s.trip.id);
          const savedTrips = hasRealProgress(s.trip) ? [s.trip, ...rest] : rest;
          return { trip: makeEmptyTrip(), chatMessages: [], progress: 0, savedTrips };
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
            progress: calcProgress(target.completedSteps),
          };
        }),

      deleteTrip: (tripId) =>
        set((s) => {
          if (tripId === s.trip.id) {
            return { trip: makeEmptyTrip(), chatMessages: [], progress: 0 };
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
            progress: calcProgress(completed),
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
            progress: calcProgress(completed),
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

      setSelectedHotel: (selectedHotel) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: {
              ...s.trip.preferences,
              selectedHotel: selectedHotel ?? undefined,
            },
            updatedAt: new Date().toISOString(),
          },
        })),

      setSelectedHotelForCity: (city, hotel) =>
        set((s) => {
          const next = { ...(s.trip.preferences.selectedHotelsByCity ?? {}) };
          if (hotel) next[city] = hotel;
          else delete next[city];
          return {
            trip: {
              ...s.trip,
              preferences: { ...s.trip.preferences, selectedHotelsByCity: next },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setSelectedFlight: (selectedFlight) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: {
              ...s.trip.preferences,
              selectedFlight: selectedFlight ?? undefined,
            },
            updatedAt: new Date().toISOString(),
          },
        })),

      toggleSelectedRestaurant: (id) =>
        set((s) => {
          const current = s.trip.preferences.selectedRestaurantIds ?? [];
          const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
          return {
            trip: {
              ...s.trip,
              preferences: { ...s.trip.preferences, selectedRestaurantIds: next },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      toggleSelectedActivity: (id) =>
        set((s) => {
          const current = s.trip.preferences.selectedActivityIds ?? [];
          const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id];
          return {
            trip: {
              ...s.trip,
              preferences: { ...s.trip.preferences, selectedActivityIds: next },
              updatedAt: new Date().toISOString(),
            },
          };
        }),

      setAirlines: (airlinePrefs) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, airlinePrefs },
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
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: [...s.trip.itineraries, itinerary],
            updatedAt: new Date().toISOString(),
          },
        })),

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

      updateWanderlogRating: (itineraryId, itemId, userRating) =>
        set((s) => ({
          trip: {
            ...s.trip,
            itineraries: s.trip.itineraries.map((it) =>
              it.id === itineraryId
                ? { ...it, wanderlog: (it.wanderlog ?? []).map((w) => (w.id === itemId ? { ...w, userRating } : w)) }
                : it
            ),
            updatedAt: new Date().toISOString(),
          },
        })),

      addMessage: (msg) =>
        set((s) => ({
          chatMessages: [
            ...s.chatMessages,
            { ...msg, id: uuid(), createdAt: new Date().toISOString() },
          ],
        })),

      clearMessages: () => set({ chatMessages: [] }),

      setGenerating: (isGenerating) => set({ isGenerating }),

      setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),

      defaultDepartureAirport: undefined,
      setDefaultDepartureAirport: (defaultDepartureAirport) => set({ defaultDepartureAirport }),
      defaultBeliPref: undefined,
    }),
    {
      name: "zimmgo-trip",
      storage: createJSONStorage(() => localStorage),
      // isGenerating and sidebarOpen are transient UI state — never persist them
      partialize: (state) => ({
        trip: state.trip,
        savedTrips: state.savedTrips,
        chatMessages: state.chatMessages,
        progress: state.progress,
        // Deliberately survives resetTrip() — a new trip should still default
        // to the airport the user flies from most, unlike trip-scoped prefs.
        defaultDepartureAirport: state.defaultDepartureAirport,
        defaultBeliPref: state.defaultBeliPref,
      }),
    }
  )
);
