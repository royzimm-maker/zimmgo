// Deterministic randomness for the mock search APIs.
// The same query must return the same results with the same IDs, otherwise a
// retried or repeated search mints new IDs and orphans anything the trip
// already selected. Isomorphic (no Node crypto) so it runs in any bundle.

type Part = string | number | boolean | null | undefined;

/** 32-bit FNV-1a hash of the parts (case- and whitespace-insensitive). */
export function hashParts(...parts: Part[]): number {
  const s = parts.map((p) => String(p ?? "").trim().toLowerCase()).join("␟");
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32 PRNG seeded from the given parts; returns floats in [0, 1). */
export function seededRandom(...parts: Part[]): () => number {
  let a = hashParts(...parts);
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Inclusive integer in [min, max] drawn from a seeded generator. */
export function seededInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

/** Stable ID derived from an item's identity, e.g. stableId("hotel", name, city). */
export function stableId(prefix: string, ...parts: Part[]): string {
  // Two differently-ordered hashes → ~64 bits, so collisions are negligible.
  const a = hashParts(prefix, ...parts).toString(36);
  const b = hashParts(...parts, prefix).toString(36);
  return `${prefix}-${a}${b}`;
}
