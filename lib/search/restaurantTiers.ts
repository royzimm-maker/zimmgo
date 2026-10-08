import type { RestaurantTier } from "@/types/trip";

// The playful one-liner each restaurant tier carries, shared by the sample
// data (restaurants.ts) and real Google results (googleRestaurants.ts).
export const PLAYFUL_LABELS: Record<RestaurantTier, string> = {
  fine_dining: "Michelin or bust",
  upscale:     "Great food without the theatre",
  midrange:    "Great food at prices that won't blow your budget",
  casual:      "Super casual — show up hungry",
  street_food: "Street food that'll leave you wanting more",
  brunch:      "Coffee and a reason to linger",
};
