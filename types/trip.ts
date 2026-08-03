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
  | "itinerary"
  | "refine";

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
  | "adventure"
  | "guided_walking_tour"
  | "guided_food_tour";

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
  region?: string;             // e.g. "Patagonia", "Southeast Asia"
  country?: string;            // e.g. "Iceland"
  cities: string[];            // e.g. ["Reykjavik", "Akureyri"]
  displayName: string;         // human-readable label for UI
  freeText?: string;           // original natural-language input from user
  departureAirport?: string;   // IATA code or city, e.g. "JFK" or "New York"
  returnAirport?: string;      // return to a different airport (open-jaw), e.g. "MXP" for fly-in FCO / fly-out MXP
  arrivalAirport?: string;     // suggested gateway airport IATA code
  routingNote?: string;        // suggested routing with reasoning
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

// How hotel/restaurant/activity ratings are sourced — mock data today, but
// shaped so a production swap to real review APIs is a straightforward drop-in.
export type ReviewSource = "Google Reviews" | "TripAdvisor" | "Booking.com" | "Expedia" | "Hotels.com";

export interface ReviewSourcePreference {
  mode: "single" | "cross_reference";
  source?: ReviewSource; // set when mode === "single"
}

// Beli is a social restaurant-ranking app — connecting an account lets ZiGy
// weight restaurant picks toward what the user has bookmarked/ranked highly
// there. No public Beli API exists today, so this is mocked (see
// lib/data/beli.ts), but shaped so a real OAuth connection is a drop-in swap.
export interface BeliPreference {
  connected: boolean;
  username?: string;
}

// A handful of higher-end meals over the trip, budgeted separately from the
// flat daily food budget (e.g. "$70/person/day normally, but 2 splurge dinners
// at $200/person").
export interface SplurgePreference {
  count: number;           // how many splurge outings over the whole trip
  budgetPerPerson: number; // $ per person for those occasions
}

export interface AirlinePreference {
  airlines: string[];
  alliances: AirlineAlliance[];
  preferNonstop: boolean;
  cabinClass: "economy" | "premium_economy" | "business" | "first";
  cabinClasses?: string[];         // multi-select; UI shows pricing for each
  prioritizeLowestFare?: boolean;  // overrides airline/alliance selections
}

// ─── User preferences (the planning form state) ───────────────────────────────
export interface TripPreferences {
  destination?: Destination;
  activities: (ActivityCategory | string)[];   // may include free-text "Other" entries
  activityRankings: Partial<Record<ActivityCategory, number>>;
  vibes: VibeTag[];
  dates?: DatePreference;
  travelers?: number;                    // number of people in the group
  rooms?: number;                        // number of rooms needed
  budgetRanges?: BudgetRange[];          // one or more acceptable lodging tiers per room / night
  customBudgetRange?: { min: number; max: number }; // custom $/night range, takes precedence over budgetRanges when set
  dailyFoodBudgetPerPerson?: number;     // food spend in $ per person per day
  splurge?: SplurgePreference;           // occasional higher-end meals, separate from the daily food budget
  lodging?: LodgingPreference;
  selectedHotel?: HotelOption;
  selectedHotelsByCity?: Record<string, HotelOption>; // per-city picks for multi-destination trips
  selectedFlight?: FlightOption;
  airlinePrefs?: AirlinePreference;
  reviewSourcePref?: ReviewSourcePreference; // how hotel/restaurant/activity ratings are sourced
  beliPref?: BeliPreference; // optional Beli account to weight restaurant picks toward
  transportation: TransportMode[];
}

// ─── Neighborhood option ──────────────────────────────────────────────────────
export interface NeighborhoodOption {
  id: string;
  name: string;
  description: string;
  vibe: string;
  bestFor: string;
  emoji: string;
  priceRange: "$" | "$$" | "$$$";
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
  city?: string; // the searched destination city — reliable for per-city grouping, unlike `location` (a specific address)
  pricePerNight: number;
  currency: string;
  rating: number;
  ratingSource?: string;  // e.g. "Google Reviews", "TripAdvisor"
  sourceRatings?: { source: string; rating: number }[]; // set when cross-referencing multiple sources
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
  ratingSource?: string;
  sourceRatings?: { source: string; rating: number }[];
  reviewCount: number;
  isLocalFavorite: boolean;
  description: string;
  location?: string;
  bookingUrl?: string;
}

export type RestaurantTier = "fine_dining" | "upscale" | "midrange" | "casual" | "street_food" | "brunch";

export interface RestaurantOption {
  id: string;
  name: string;
  cuisine: string;
  tier: RestaurantTier;
  playfulCategory: string;
  priceRange: "$" | "$$" | "$$$" | "$$$$";
  rating: number;
  ratingSource?: string;
  sourceRatings?: { source: string; rating: number }[];
  reviewCount: number;
  location: string;
  description: string;
  mustOrder?: string;
  imageUrl?: string;
  bookingUrl?: string;
  menuUrl?: string;
  isBeliPick?: boolean;
  beliNote?: string;
}

export interface ItineraryDay {
  date: string;           // ISO date
  dayNumber: number;
  theme: string;          // e.g. "Arrival & Old Town Exploration"
  location?: string;      // city or region for this day
  morning: string[];
  afternoon: string[];
  evening: string[];
  meals: { type: "breakfast" | "lunch" | "dinner"; suggestion: string }[];
  notes?: string;
}

export interface ItineraryRefinements {
  neighborhoodId?: string;
  excludedActivityIds?: string[];
}

export interface FinalizedPlan {
  // dayNumber (1-based) → array of card ids ("act-{id}" or "rest-{id}")
  dayCards: Record<number, string[]>;
  // Cards the user left unplaced
  bankCards: string[];
}

// A saved-for-later note the traveller can pull up during the trip — an
// activity/restaurant they skipped scheduling, a local-discovery pick, or a
// free-text entry of their own. Distinct from the day-by-day plan.
export interface WanderlogItem {
  id: string;
  label: string;
  note?: string;
  userRating?: number; // 1-5 — the traveller's own rating, set once they've actually been
  source: "activity" | "restaurant" | "discovery" | "custom";
  location?: string;
  addedAt: string;
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
  restaurants?: RestaurantOption[];
  totalEstimatedCost: number;
  currency: string;
  aiSummary: string;
  whyThisWorks: string;
  neighborhoods?: NeighborhoodOption[];
  refinements?: ItineraryRefinements;
  wanderlog?: WanderlogItem[];
  finalizedPlan?: FinalizedPlan;
  reviewCompleted?: boolean; // true once the user has stepped through the flights/hotels/restaurants/activities wizard
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
  // Short label shown as a confirmation chip when this message applied a
  // preference change directly (e.g. "Updated lodging: Type → Resort"),
  // distinct from the message's own prose reply.
  preferenceUpdateSummary?: string;
}

// ─── API response shapes ───────────────────────────────────────────────────────
export interface ApiResponse<T> {
  data?: T;
  error?: string;
  status: "success" | "error" | "partial";
}

// ─── Progress calculation helper ───────────────────────────────────────────────
// Vibe and Activities sit before Lodging (rather than right after Budget) so
// ZiGy's smart-picks for Lodging — and Activities' own pick — can actually use
// the traveller's vibe preference; each smart-pick prompt only reads whatever
// preferences are already in the store, so ordering directly drives accuracy.
export const ORDERED_STEPS: StepId[] = [
  "destination",
  "dates",
  "airlines",
  "budget",
  "vibe",
  "activities",
  "lodging",
  "transportation",
  "itinerary",
  "refine",
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
  refine:         { id: "refine",         label: "Personalize",    description: "Fine-tune your plan",              skippable: true  },
};

export function calcProgress(completedSteps: StepId[]): number {
  const required = ORDERED_STEPS.filter((s) => !STEP_META[s].skippable);
  const done = completedSteps.filter((s) => required.includes(s)).length;
  return Math.round((done / required.length) * 100);
}

export const BUDGET_LABELS: Record<BudgetRange, string> = {
  under_500:  "Under $200 / room / night",
  "500_750":  "$200 – $400 / room / night",
  "750_1000": "$400 – $700 / room / night",
  "1000_plus": "$700+ / room / night",
};

export const BUDGET_MAX: Record<BudgetRange, number> = {
  under_500:  200,
  "500_750":  400,
  "750_1000": 700,
  "1000_plus": 1500,
};

// Default nightly ceiling used when the user hasn't picked a lodging budget yet
// (e.g. hotel search running before the Budget step completes).
export const DEFAULT_BUDGET_MAX = 300;

// Single source of truth for "given what the user picked, what's the effective
// $/night ceiling and how should it be described" — a user can select multiple
// lodging tiers or set a custom min–max range instead of a single tier, so
// every caller (hotel search, AI prompts, the Lodging step's own preview) needs
// the same precedence: custom range wins, else the highest ceiling across every
// selected tier, else the default.
export function resolveBudget(preferences: {
  customBudgetRange?: { min: number; max: number };
  budgetRanges?: BudgetRange[];
}): { label: string; max: number } | null {
  if (preferences.customBudgetRange) {
    const { min, max } = preferences.customBudgetRange;
    return { label: `$${min}–$${max} / room / night`, max };
  }
  if (preferences.budgetRanges?.length) {
    const label = preferences.budgetRanges.map((r) => BUDGET_LABELS[r]).join(" or ");
    const max = Math.max(...preferences.budgetRanges.map((r) => BUDGET_MAX[r]));
    return { label, max };
  }
  return null;
}
