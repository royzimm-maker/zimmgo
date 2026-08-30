// @vitest-environment node
import { describe, it, expect } from "vitest";
import { expectedGateCookieValue } from "@/lib/gateAuth";

describe("expectedGateCookieValue", () => {
  it("is deterministic for the same password", async () => {
    const a = await expectedGateCookieValue("hunter2");
    const b = await expectedGateCookieValue("hunter2");
    expect(a).toBe(b);
  });

  it("differs for different passwords", async () => {
    const a = await expectedGateCookieValue("hunter2");
    const b = await expectedGateCookieValue("hunter3");
    expect(a).not.toBe(b);
  });

  it("never just echoes the raw password back", async () => {
    const value = await expectedGateCookieValue("hunter2");
    expect(value).not.toContain("hunter2");
  });
});
