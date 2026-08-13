import type { TripPreferences, HotelOption, ActivityOption, RestaurantOption, ItineraryDay } from "@/types/trip";

export type SmartPickKind = "hotel" | "schedule" | "activities" | "vibes" | "lodging" | "activities_for_city";

export interface SmartPickRequestBody {
  kind: SmartPickKind;
  city?: string;
  preferences: TripPreferences;
  hotels?: HotelOption[];
  days?: ItineraryDay[];
  activities?: ActivityOption[];
  restaurants?: RestaurantOption[];
  candidates?: { id: string; label: string }[];
}

export interface SmartPick {
  id: string;
  dayNumber?: number;
  reason: string;
}

export interface SmartPickResponse {
  picks: SmartPick[];
  summary: string;
}
