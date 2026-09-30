// @vitest-environment node
import { describe, it, expect } from "vitest";
import {
  GATE_SESSION_MAX_AGE_S, createGateToken, gateAccounts, matchGatePassword, safeNextPath, secretsMatch, timingSafeEqual, verifyGateToken,
} from "@/lib/gateAuth";

const alex = { label: "alex", password: "alex-pw" };
const sam = { label: "sam", password: "sam-pw" };
const NOW = Date.UTC(2026, 8, 29);

describe("gateAccounts", () => {
  it("reads per-person passwords, plus the legacy shared password as 'shared'", () => {
    expect(gateAccounts({ SITE_PASSWORDS: "alex=alex-pw, sam=sam-pw", SITE_PASSWORD: "old" })).toEqual([
      alex, sam, { label: "shared", password: "old" },
    ]);
  });

  it("keeps '=' inside a password and skips malformed or duplicate entries", () => {
    expect(gateAccounts({ SITE_PASSWORDS: "alex=a=b,=nolabel,bad name=x,alex=again,empty=" })).toEqual([
      { label: "alex", password: "a=b" },
    ]);
  });

  it("is empty — gate off — when nothing is configured", () => {
    expect(gateAccounts({})).toEqual([]);
  });
});

describe("matchGatePassword", () => {
  it("returns whose password it is", async () => {
    expect(await matchGatePassword("sam-pw", [alex, sam])).toEqual(sam);
  });

  it("returns null for a wrong password, including a prefix of a real one", async () => {
    expect(await matchGatePassword("alex", [alex, sam])).toBeNull();
    expect(await matchGatePassword("", [alex, sam])).toBeNull();
  });
});

describe("gate session tokens", () => {
  it("round-trips to the person who signed in, without containing their password", async () => {
    const token = await createGateToken(alex, NOW);
    expect(token).not.toContain("alex-pw");
    expect(await verifyGateToken(token, [alex, sam], NOW + 1000)).toEqual(alex);
  });

  it("is revoked for that person alone when their entry is removed", async () => {
    const alexToken = await createGateToken(alex, NOW);
    const samToken = await createGateToken(sam, NOW);
    expect(await verifyGateToken(alexToken, [sam], NOW)).toBeNull();
    expect(await verifyGateToken(samToken, [sam], NOW)).toEqual(sam);
  });

  it("is revoked when that person's password changes", async () => {
    const token = await createGateToken(alex, NOW);
    expect(await verifyGateToken(token, [{ label: "alex", password: "new-pw" }], NOW)).toBeNull();
  });

  it("expires after the session lifetime, enforced server-side", async () => {
    const token = await createGateToken(alex, NOW);
    expect(await verifyGateToken(token, [alex], NOW + (GATE_SESSION_MAX_AGE_S - 60) * 1000)).toEqual(alex);
    expect(await verifyGateToken(token, [alex], NOW + (GATE_SESSION_MAX_AGE_S + 60) * 1000)).toBeNull();
  });

  it("rejects forged, tampered, or malformed tokens", async () => {
    const token = await createGateToken(alex, NOW);
    const [v, , issued, mac] = token.split(".");
    // Claiming to be someone else with alex's signature
    expect(await verifyGateToken([v, "sam", issued, mac].join("."), [alex, sam], NOW)).toBeNull();
    // Extending your own session
    expect(await verifyGateToken([v, "alex", String(Number(issued) + 3600), mac].join("."), [alex], NOW + 7200_000)).toBeNull();
    for (const bad of [undefined, "", "garbage", "v0.alex.1.abc", `${token}.extra`]) {
      expect(await verifyGateToken(bad, [alex], NOW)).toBeNull();
    }
  });

  it("doesn't accept the old unsigned cookie format", async () => {
    // Previously the cookie was a bare SHA-256 hex digest of the password.
    expect(await verifyGateToken("a".repeat(64), [alex], NOW)).toBeNull();
  });
});

describe("timingSafeEqual", () => {
  it("compares exactly", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/plan?step=dates")).toBe("/plan?step=dates");
  });

  it("refuses anything that would leave the site", () => {
    for (const next of ["https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "", null, undefined]) {
      expect(safeNextPath(next)).toBe("/");
    }
  });
});

describe("secretsMatch", () => {
  it("matches only the exact secret, whatever the lengths", async () => {
    expect(await secretsMatch("secret", "secret")).toBe(true);
    expect(await secretsMatch("secre", "secret")).toBe(false);
    expect(await secretsMatch("secret!", "secret")).toBe(false);
    expect(await secretsMatch("", "secret")).toBe(false);
  });
});
