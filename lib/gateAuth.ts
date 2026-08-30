// Shared by middleware.ts (Edge runtime) and app/api/gate/route.ts (Node
// runtime) — Web Crypto's `crypto.subtle` is the one hashing API both
// support, unlike Node's `crypto` module (used elsewhere in this app, e.g.
// trip-sync's randomUUID) which Edge middleware can't use.
export const GATE_COOKIE_NAME = "zimmgo-gate";

// A plain SHA-256 digest, not HMAC — the only goal is "don't put the raw
// SITE_PASSWORD in a cookie", not authenticating a message from a third
// party, so there's no need for key management here.
export async function expectedGateCookieValue(password: string): Promise<string> {
  const data = new TextEncoder().encode(`zimmgo-gate:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
