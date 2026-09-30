// The one place that decides whether two place names refer to the same
// place, and which of a trip's cities an item belongs to. Every screen that
// buckets hotels/activities/restaurants/days by city must use these, so they
// can't drift apart again (they did: one matcher did raw substring checks —
// "Nice" matched "Venice" — while another matched on first word alone — "San
// Sebastián" matched "San Francisco").

// First words too common across unrelated places to identify one on their own.
const GENERIC_LEADING_WORDS = new Set([
  "san", "santa", "santo", "sao", "saint", "st", "ste", "new", "north", "south", "east", "west",
  "port", "porto", "puerto", "lake", "mount", "mt", "cape", "las", "los", "la", "le", "les", "el",
  "al", "upper", "lower", "great", "little", "old", "isle", "isla", "ile", "costa", "playa", "bay",
  "city", "greater", "central", "grand", "gran", "da", "de", "del", "di", "du",
]);

/** Lowercased, accent-free words of a place name, without a leading "the". */
export function locationWords(name: string): string[] {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);
  return words[0] === "the" ? words.slice(1) : words;
}

function containsRun(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  for (let i = 0; i + needle.length <= haystack.length; i++) {
    if (needle.every((w, j) => haystack[i + j] === w)) return true;
  }
  return false;
}

/**
 * Do two place names refer to the same place? Matches when one name's words
 * appear, in order, as whole words in the other ("Rome" / "Trastevere,
 * Rome", "Amalfi Coast" / "the Amalfi Coast"), or when both start with the
 * same distinctive word ("Dolomites, Italy" / "Dolomites (Val Gardena)").
 * Missing names never match.
 */
export function sameLocation(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  const wa = locationWords(a);
  const wb = locationWords(b);
  if (!wa.length || !wb.length) return false;
  if (containsRun(wa, wb) || containsRun(wb, wa)) return true;
  return wa[0] === wb[0] && wa[0].length >= 3 && !GENERIC_LEADING_WORDS.has(wa[0]);
}

/**
 * Which of the trip's cities an item located at `location` belongs to. An
 * exact match wins over a looser one, so "Rome Outskirts" goes to that city
 * rather than to "Rome".
 *
 * With `fallbackToLast`, an item matching no city goes to the last one —
 * activities and restaurants are often tagged with specific towns ("Vik and
 * South Coast Iceland") that share no word with the trip's coarse city labels
 * ("the Ring Road"), and the last leg is the touring/loop leg in road-trip
 * itineraries, so nothing is orphaned. Leave it off where a wrong city is
 * worse than none (hotels).
 */
export function resolveCity(
  location: string | undefined,
  cities: string[],
  { fallbackToLast = false }: { fallbackToLast?: boolean } = {}
): string | undefined {
  if (!location || !cities.length) return undefined;
  const words = locationWords(location).join(" ");
  return (
    cities.find((c) => locationWords(c).join(" ") === words) ??
    cities.find((c) => sameLocation(location, c)) ??
    (fallbackToLast ? cities[cities.length - 1] : undefined)
  );
}

/**
 * The cities an itinerary was planned for, in visiting order — the one key
 * for every per-city decision about it (hotel picks, city tabs, auto-plan,
 * the day view and exports). Taken from its days, which generation assigns
 * from the traveller's city list at the time: that stays right even if the
 * traveller edits their destinations later, and leaves out a city that got
 * no days. Falls back to the traveller's list, then the destination's name,
 * when there's no itinerary yet.
 */
export function itineraryCities(
  itinerary: { days: { location?: string }[] } | null | undefined,
  destination?: { cities?: string[]; displayName?: string }
): string[] {
  const fromDays: string[] = [];
  for (const day of itinerary?.days ?? []) {
    if (day.location && !fromDays.includes(day.location)) fromDays.push(day.location);
  }
  if (fromDays.length) return fromDays;
  const planned = (destination?.cities ?? []).filter(Boolean);
  if (planned.length) return planned;
  return destination?.displayName ? [destination.displayName] : [];
}
