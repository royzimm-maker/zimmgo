/**
 * Maps city/sub-region names to the pool key used by both activities and restaurants.
 * A single source of truth — import this instead of maintaining parallel alias maps.
 */
export const DESTINATION_ALIASES: Record<string, string> = {
  "florence":   "italy",   "tuscany":  "italy",   "venice":  "italy",   "naples":  "italy",
  "milan":      "italy",   "sicily":   "italy",   "bologna": "italy",   "cinque":  "italy",
  "positano":   "amalfi",  "ravello":  "amalfi",  "praiano": "amalfi",  "salerno": "amalfi",
  "cortina":    "dolomit", "bolzano":  "dolomit", "merano":  "dolomit", "alta badia": "dolomit",
  "athens":     "greece",  "thessal":  "greece",
  "lisbon":     "portugal","porto":    "portugal",
  "barcelona":  "spain",   "madrid":   "spain",   "seville": "spain",
};
