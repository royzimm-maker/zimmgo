import type { VibeTag } from "@/types/trip";

// The trip vibes a traveller can pick (the Vibe step), with their display
// names. Prompts describe vibes by name too — Claude echoes what it reads, so
// a raw id like "great_food" would otherwise end up in the traveller's text.
export const VIBES: { id: VibeTag; label: string; icon: string; sublabel: string }[] = [
  { id: "romantic",             label: "Romantic",            icon: "💑",  sublabel: "Couple-focused, slow-paced, indulgent" },
  { id: "nightlife",            label: "Nightlife",           icon: "🎉",  sublabel: "Bars, clubs, late nights" },
  { id: "great_food",           label: "Food-Forward Travel", icon: "🍽️",  sublabel: "Meals are a highlight — good reservations, local favorites" },
  { id: "outdoor",              label: "Outdoors & Nature",   icon: "🏞️",  sublabel: "Hiking, scenic landscapes, time outside" },
  { id: "beaches",              label: "Beaches",             icon: "🏖️",  sublabel: "Sun, sand, and sea" },
  { id: "shopping",             label: "Shopping",            icon: "🛍️",  sublabel: "Local markets to luxury boutiques" },
  { id: "architecture",         label: "Architecture",        icon: "🏰",  sublabel: "Iconic buildings and design" },
  { id: "family_friendly",      label: "Family Friendly",    icon: "👨‍👩‍👧", sublabel: "Great for all ages" },
  { id: "off_the_beaten_path",  label: "Off the Beaten Path", icon: "🗺️", sublabel: "Local gems, no tour groups" },
];

/** A vibe's display name; a free-text vibe is its own name. */
export function vibeLabel(vibe: string): string {
  return VIBES.find((v) => v.id === vibe)?.label ?? vibe;
}

/**
 * The vibes as readable text, e.g. "Food-Forward Travel, Architecture".
 * `withIds` adds each known vibe's id ("Food-Forward Travel (great_food)") for
 * prompts whose tools take vibe ids back.
 */
export function describeVibes(vibes: string[], withIds = false): string {
  return vibes.map((v) => (withIds && vibeLabel(v) !== v ? `${vibeLabel(v)} (${v})` : vibeLabel(v))).join(", ");
}
