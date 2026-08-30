// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GATE_COOKIE_NAME, expectedGateCookieValue } from "@/lib/gateAuth";
import { POST } from "@/app/api/gate/route";

const ORIGINAL_SITE_PASSWORD = process.env.SITE_PASSWORD;

function postRequest(body: unknown) {
  return new NextRequest("http://localhost/api/gate", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  process.env.SITE_PASSWORD = "hunter2";
});

afterEach(() => {
  process.env.SITE_PASSWORD = ORIGINAL_SITE_PASSWORD;
});

describe("POST /api/gate", () => {
  it("refuses every request when SITE_PASSWORD isn't configured", async () => {
    delete process.env.SITE_PASSWORD;
    const res = await POST(postRequest({ password: "anything" }));
    expect(res.status).toBe(503);
  });

  it("rejects the wrong password without setting a cookie", async () => {
    const res = await POST(postRequest({ password: "wrong" }));
    expect(res.status).toBe(401);
    expect(res.cookies.get(GATE_COOKIE_NAME)).toBeUndefined();
  });

  it("accepts the right password and sets the expected cookie value", async () => {
    const res = await POST(postRequest({ password: "hunter2" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(res.cookies.get(GATE_COOKIE_NAME)?.value).toBe(await expectedGateCookieValue("hunter2"));
  });
});
