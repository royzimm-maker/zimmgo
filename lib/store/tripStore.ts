"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { v4 as uuid } from "uuid";
import type {
  Trip,
  TripPreferences,
  StepId,
  GeneratedItinerary,
  ChatMessage,
  Destination,
  DatePreference,
  LodgingPreference,
  AirlinePreference,
  ActivityCategory,
  VibeTag,
  TransportMode,
  BudgetRange,
  ORDERED_STEPS,
} from "@/types/trip";
import { calcProgress } from "@/types/trip";

// ─── State shape ───────────────────────────────────────────────────────────────
interface TripState {
  trip: Trip;
  chatMessages: ChatMessage[];
  isGenerating: boolean;   // AI is currently producing output
  sidebarOpen: boolean;

  // Trip-level actions
  resetTrip: () => void;
  setTripName: (name: string) => void;

  // Step navigation
  goToStep: (step: StepId) => void;
  completeStep: (step: StepId) => void;
  uncompleteStep: (step: StepId) => void;

  // Individual preference setters
  setDestination: (dest: Destination) => void;
  setActivities: (activities: ActivityCategory[]) => void;
  setVibes: (vibes: VibeTag[]) => void;
  setDates: (dates: DatePreference) => void;
  setBudget: (range: BudgetRange) => void;
  setBudgetDetails: (details: { travelers?: number; rooms?: number; dailyFoodBudgetPerPerson?: number }) => void;
  setLodging: (lodging: LodgingPreference) => void;
  setAirlines: (prefs: AirlinePreference) => void;
  setTransportation: (modes: TransportMode[]) => void;

  // Itinerary
  addItinerary: (itinerary: GeneratedItinerary) => void;

  // Chat
  addMessage: (msg: Omit<ChatMessage, "id" | "createdAt">) => void;
  clearMessages: () => void;

  // UI
  setGenerating: (val: boolean) => void;
  setSidebarOpen: (val: boolean) => void;

  // Derived
  progress: number;
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
export const useTripStore = create<TripState>()(
  persist(
    (set, get) => ({
      trip: makeEmptyTrip(),
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

      setBudget: (budgetRange) =>
        set((s) => ({
          trip: {
            ...s.trip,
            preferences: { ...s.trip.preferences, budgetRange },
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
    }),
    {
      name: "zimmgo-trip",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
