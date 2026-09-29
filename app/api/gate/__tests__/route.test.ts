// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { mockRateLimit } = vi.hoisted(() => ({ mockRateLimit: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ rateLimit: mockRateLimit }));

import { GATE_COOKIE_NAME, gateAccounts, verifyGateToken } from "@/lib/gateAuth";
import { POST } from "@/app/api/gate/route";
import { proxy } from "@/proxy";

const ORIGINAL = { SITE_PASSWORD: process.env.SITE_PASSWORD, SITE_PASSWORDS: process.env.SITE_PASSWORDS };

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
function pageRequest(cookie?: string) {
  return new NextRequest("http://localhost/plan?x=1", { headers: cookie ? { cookie: `${GATE_COOKIE_NAME}=${cookie}` } : {} });
}
async function signIn(password: string) {
  return (await POST(postRequest({ password }))).cookies.get(GATE_COOKIE_NAME)?.value;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRateLimit.mockResolvedValue(null);
  vi.spyOn(console, "info").mockImplementation(() => {});
  process.env.SITE_PASSWORDS = "alex=alex-pw,sam=sam-pw";
  delete process.env.SITE_PASSWORD;
});

afterEach(() => {
  for (const [k, v] of Object.entries(ORIGINAL)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("POST /api/gate", () => {
  it("refuses every request when no password is configured", async () => {
    delete process.env.SITE_PASSWORDS;
    const res = await POST(postRequest({ password: "anything" }));
    expect(res.status).toBe(503);
  });

  it("rejects the wrong password without setting a cookie", async () => {
    const res = await POST(postRequest({ password: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(GATE_COOKIE_NAME)).toBeUndefined();
  });

  it("signs a person in with a session tied to them", async () => {
    const res = await POST(postRequest({ password: "sam-pw" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const token = res.cookies.get(GATE_COOKIE_NAME)?.value;
    expect((await verifyGateToken(token, gateAccounts()))?.label).toBe("sam");
    expect(console.info).toHaveBeenCalledWith("[gate] signed in:", "sam");
  });

  it("still accepts the legacy single SITE_PASSWORD", async () => {
    delete process.env.SITE_PASSWORDS;
    process.env.SITE_PASSWORD = "hunter2";
    expect((await POST(postRequest({ password: "hunter2" }))).status).toBe(200);
  });

  it("is rate limited", async () => {
    mockRateLimit.mockResolvedValue(new Response("{}", { status: 429 }));
    expect((await POST(postRequest({ password: "alex-pw" }))).status).toBe(429);
  });
});

describe("proxy (site gate)", () => {
  it("lets a signed-in person through", async () => {
    const res = await proxy(pageRequest(await signIn("alex-pw")));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects to the gate without a session, keeping where they were going", async () => {
    const res = await proxy(pageRequest());
    expect(res.headers.get("location")).toBe("http://localhost/gate?next=%2Fplan%3Fx%3D1");
  });

  it("locks out one person — and only them — once their entry is removed", async () => {
    const alexCookie = await signIn("alex-pw");
    const samCookie = await signIn("sam-pw");
    process.env.SITE_PASSWORDS = "sam=sam-pw";

    const alexRes = await proxy(pageRequest(alexCookie));
    expect(alexRes.headers.get("location")).toContain("/gate");
    expect(alexRes.cookies.get(GATE_COOKIE_NAME)?.value).toBe(""); // stale session cleared
    expect((await proxy(pageRequest(samCookie))).headers.get("location")).toBeNull();
  });

  it("is a no-op when the gate isn't configured", async () => {
    delete process.env.SITE_PASSWORDS;
    expect((await proxy(pageRequest())).headers.get("location")).toBeNull();
  });
});
