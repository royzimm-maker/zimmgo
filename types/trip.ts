// ─── Planning step identifiers ────────────────────────────────────────────────
export type StepId =
  | "destination"
  | "activities"
  | "vibe"
  | "dates"
  | "budget"
  | "lodging"
  | "airlines"
  | "transportation"
  | "itinerary";

export interface PlanningStep {
  id: StepId;
  label: string;
  description: string;
  completed: boolean;
  skippable: boolean;
}

// ─── Domain enums ─────────────────────────────────────────────────────────────
export type BudgetRange = "under_500" | "500_750" | "750_1000" | "1000_plus";

export type LodgingType = "hotel" | "airbnb" | "boutique" | "resort";

export type LodgingStarRating = 3 | 4 | 5;

export type TransportMode =
  | "rental_car"
  | "rideshare"
  | "private_driver"
  | "public_transit";

export type AirlineAlliance = "star_alliance" | "oneworld" | "skyteam";

export type ActivityCategory =
  | "skiing"
  | "hiking"
  | "sailing"
  | "food"
  | "diving"
  | "cycling"
  | "cultural"
  | "photography"
  | "wellness"
  | "adventure";

export type VibeTag =
  | "nightlife"
  | "great_food"
  | "outdoor"
  | "museums"
  | "shopping"
  | "beaches"
  | "architecture"
  | "romantic"
  | "family_friendly"
  | "off_the_beaten_path";

// ─── Core preference objects ───────────────────────────────────────────────────
export interface Destination {
  region?: string;       // e.g. "Patagonia", "Southeast Asia"
  country?: string;      // e.g. "Iceland"
  cities: string[];      // e.g. ["Reykjavik", "Akureyri"]
  displayName: string;   // human-readable label for UI
}

export interface DatePreference {
  type: "exact" | "flexible";
  startDate?: string;    // ISO date string
  endDate?: string;
  flexibleMonth?: string; // e.g. "2025-06"
  flexibleDuration?: number; // days
}

export interface LodgingPreference {
  types: LodgingType[];
  minStars: LodgingStarRating;
  amenities: string[];
}

export interface AirlinePreference {
  airlines: string[];     // e.g. ["Delta Air Lines", "United Airlines"]
  alliances: AirlineAlliance[];
  preferNonstop: boolean;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
}

// ─── User preferences (the planning form state) ───────────────────────────────
export interface TripPreferences {
  destination?: Destination;
  activities: ActivityCategory[];
  activityRankings: Partial<Record<ActivityCategory, number>>; // 1 = top priority
  vibes: VibeTag[];
  dates?: DatePreference;
  budgetRange?: BudgetRange;
  budgetDailyMax?: number;
  lodging?: LodgingPreference;
  airlinePrefs?: AirlinePreference;
  transportation: TransportMode[];
}

// ─── Recommendation outputs ────────────────────────────────────────────────────
export interface FlightOption {
  id: string;
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departureTime: string;
  arrivalTime: string;
  duration: string;
  stops: number;
  price: number;
  currency: string;
  cabinClass: string;
  bookingUrl?: string;
}

export interface HotelOption {
  id: string;
  name: string;
  stars: number;
  location: string;
  pricePerNight: number;
  currency: string;
  rating: number;         // 0–10
  reviewCount: number;
  highlights: string[];
  imageUrl?: string;
  bookingUrl?: string;
}

export interface ActivityOption {
  id: string;
  name: string;
  category: ActivityCategory | string;
  duration: string;
  price: number;
  currency: string;
  rating: number;
  reviewCount: number;
  isLocalFavorite: boolean;
  description: string;
  bookingUrl?: string;
}

export interface ItineraryDay {
  date: string;           // ISO date
  dayNumber: number;
  theme: string;          // e.g. "Arrival & Old Town Exploration"
  morning: string[];
  afternoon: string[];
  evening: string[];
  meals: { type: "breakfast" | "lunch" | "dinner"; suggestion: string }[];
  notes?: string;
}

export interface GeneratedItinerary {
  id: string;
  tripId: string;
  version: number;
  createdAt: string;
  days: ItineraryDay[];
  flights: FlightOption[];
  hotels: HotelOption[];
  activities: ActivityOption[];
  totalEstimatedCost: number;
  currency: string;
  aiSummary: string;      // 2–3 sentence overview from the AI
  whyThisWorks: string;   // AI explanation of why this plan fits the user
}

// ─── Top-level Trip entity ─────────────────────────────────────────────────────
export interface Trip {
  id: string;
  userId?: string;
  name: string;
  preferences: TripPreferences;
  currentStep: StepId;
  completedSteps: StepId[];
  itineraries: GeneratedItinerary[];
  createdAt: string;
  updatedAt: string;
}

// ─── Chat message ──────────────────────────────────────────────────────────────
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  stepContext?: StepId;
}

// ─── API response shapes ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error" | "partial";
}

// ─── Progress calculation helper ───────────────────────────────────────────────
export const ORDERED_STEPS: StepId[] = [
  "destination",
  "activities",
  "vibe",
  "dates",
  "budget",
  "lodging",
  "airlines",
  "transportation",
  "itinerary",
];

export const STEP_META: Record<StepId, Omit<PlanningStep, "completed">> = {
  destination:    { id: "destination",    label: "Destination",    description: "Where are you headed?",          skippable: false },
  activities:     { id: "activities",     label: "Activities",     description: "What do you love to do?",        skippable: false },
  vibe:           { id: "vibe",           label: "Vibe",           description: "What's the mood?",               skippable: false },
  dates:          { id: "dates",          label: "Dates",          description: "When are you going?",            skippable: false },
  budget:         { id: "budget",         label: "Budget",         description: "What's your daily spend?",       skippable: false },
  lodging:        { id: "lodging",        label: "Lodging",        description: "Hotels or Airbnb?",              skippable: false },
  airlines:       { id: "airlines",       label: "Flights",        description: "Any airline preferences?",       skippable: true  },
  transportation: { id: "transportation", label: "Getting Around", description: "How will you move locally?",     skippable: false },
  itinerary:      { id: "itinerary",      label: "Itinerary",      description: "Your personalised day-by-day plan", skippable: false },
};

export function calcProgress(completedSteps: StepId[]): number {
  const required = ORDERED_STEPS.filter((s) => !STEP_META[s].skippable);
  const done = completedSteps.filter((s) => required.includes(s)).length;
  return Math.round((done / required.length) * 100);
}

export const BUDGET_LABELS: Record<BudgetRange, string> = {
  under_500: "Under $500 / day",
  "500_750": "$500 – $750 / day",
  "750_1000": "$750 – $1,000 / day",
  "1000_plus": "$1,000+ / day",
};

export const BUDGET_MAX: Record<BudgetRange, number> = {
  under_500: 499,
  "500_750": 750,
  "750_1000": 1000,
  "1000_plus": 2500,
};
