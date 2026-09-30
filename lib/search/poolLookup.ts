// Shared by activities.ts/restaurants.ts/hotels.ts's findXBase functions — each
// looks up mock content for a destination via a direct substring match against
// its own pool's keys, then an alias map, falling back to a "default" entry.
// The alias map's promises don't always match what every pool actually
// contains (e.g. DESTINATION_ALIASES pointing to a pool key a given file
// hasn't added content for yet), so this always falls back to the pool's own
// "default" entry rather than risking undefined and crashing every caller.
export function resolvePool<T>(
  destination: string,
  pool: Record<string, T>,
  aliases: Record<string, string>
): T {
  const lower = (destination ?? "").toLowerCase();
  const direct = Object.keys(pool).find((k) => lower.includes(k));
  if (direct) return pool[direct];
  const alias = Object.entries(aliases).find(([a]) => lower.includes(a));
  return pool[alias?.[1] ?? "default"] ?? pool.default;
}
