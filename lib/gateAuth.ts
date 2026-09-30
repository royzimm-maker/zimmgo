// Site-wide "friends and family" gate: per-person passwords, per-person
// revocable sessions. Shared by proxy.ts (the site gate) and
// app/api/gate/route.ts. Uses Web Crypto (`crypto.subtle`), available in every
// runtime Next.js runs in, so the same code works wherever the gate runs.
//
// Configuration (Vercel env / .env.local):
//   SITE_PASSWORDS="alex=first-password,sam=second-password"
//     One entry per person. Names: letters, digits, "-" or "_". Passwords
//     can't contain commas. Remove or change someone's entry to revoke their
//     access — every session they have stops working on their next request,
//     and nobody else is affected.
//   SITE_PASSWORD="one-password"
//     The original single shared password; still honoured, as a person
//     named "shared". Change it to sign out everyone who used it.
// With neither set, the gate is off (the default for local dev).

export const GATE_COOKIE_NAME = "zimmgo-gate";
export const GATE_SESSION_MAX_AGE_S = 60 * 60 * 24 * 90; // ~90 days

export interface GateAccount {
  label: string;
  password: string;
}

const LABEL_RE = /^[A-Za-z0-9_-]{1,40}$/;

export function gateAccounts(env: Record<string, string | undefined> = process.env): GateAccount[] {
  const accounts: GateAccount[] = [];
  for (const entry of (env.SITE_PASSWORDS ?? "").split(",")) {
    const eq = entry.indexOf("=");
    if (eq <= 0) continue;
    const label = entry.slice(0, eq).trim();
    const password = entry.slice(eq + 1).trim();
    if (LABEL_RE.test(label) && password && !accounts.some((a) => a.label === label)) {
      accounts.push({ label, password });
    }
  }
  const shared = env.SITE_PASSWORD?.trim();
  if (shared && !accounts.some((a) => a.label === "shared")) accounts.push({ label: "shared", password: shared });
  return accounts;
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Constant-time for equal-length inputs: every character is compared, so the
// time taken doesn't reveal how much of a guess was right. (Edge has no
// crypto.timingSafeEqual.) Callers only compare fixed-length digests.
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Whether a submitted secret equals the configured one, without leaking its length or how much matched. */
export async function secretsMatch(submitted: string, configured: string): Promise<boolean> {
  const [probe, digest] = await Promise.all([hmacHex("zimmgo-secret-compare", submitted), hmacHex("zimmgo-secret-compare", configured)]);
  return timingSafeEqual(probe, digest);
}

// Which person's password this is, if any. Both sides are hashed to the same
// length first, and every account is checked without stopping early, so
// neither the password's length nor its position in the list leaks.
export async function matchGatePassword(submitted: string, accounts: GateAccount[]): Promise<GateAccount | null> {
  const probe = await hmacHex("zimmgo-gate-compare", submitted);
  let match: GateAccount | null = null;
  for (const account of accounts) {
    const digest = await hmacHex("zimmgo-gate-compare", account.password);
    if (timingSafeEqual(probe, digest) && !match) match = account;
  }
  return match;
}

// Session token: "v1.<label>.<issued-at seconds>.<HMAC>", keyed by that
// person's password. It can't be forged without the password, and removing
// or changing the password invalidates every token issued under it.
function tokenMessage(label: string, issuedAt: number): string {
  return `zimmgo-gate:v1:${label}:${issuedAt}`;
}

export async function createGateToken(account: GateAccount, now = Date.now()): Promise<string> {
  const issuedAt = Math.floor(now / 1000);
  return `v1.${account.label}.${issuedAt}.${await hmacHex(account.password, tokenMessage(account.label, issuedAt))}`;
}

/** The account a session token belongs to, or null if it's invalid, expired, or revoked. */
export async function verifyGateToken(
  token: string | undefined,
  accounts: GateAccount[],
  now = Date.now()
): Promise<GateAccount | null> {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4 || parts[0] !== "v1") return null;
  const [, label, issuedRaw, mac] = parts;
  const issuedAt = Number(issuedRaw);
  const nowS = Math.floor(now / 1000);
  if (!Number.isInteger(issuedAt) || issuedAt > nowS + 60 || nowS - issuedAt > GATE_SESSION_MAX_AGE_S) return null;
  const account = accounts.find((a) => a.label === label);
  if (!account) return null;
  const expected = await hmacHex(account.password, tokenMessage(label, issuedAt));
  return timingSafeEqual(mac, expected) ? account : null;
}

// Where to send someone after they get through the gate: only a path on this
// site. "//evil.example" and "/\evil.example" are protocol-relative URLs that
// browsers would follow off-site, so they're refused too.
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
