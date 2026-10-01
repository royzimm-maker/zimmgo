// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { inBackground } from "@/lib/background";

let logged: ReturnType<typeof vi.spyOn>;
beforeEach(() => { logged = vi.spyOn(console, "error").mockImplementation(() => {}); });
afterEach(() => vi.restoreAllMocks());

describe("inBackground", () => {
  it("runs the work", async () => {
    const work = vi.fn(async () => 3);
    await expect(inBackground("t", work)).resolves.toBeUndefined();
    expect(work).toHaveBeenCalled();
    expect(logged).not.toHaveBeenCalled();
  });

  it("logs a rejection instead of passing it on", async () => {
    await expect(inBackground("t", async () => { throw new Error("db down"); })).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledWith("[t] background cleanup failed", expect.any(Error));
  });

  it("logs a synchronous throw instead of throwing into the caller", async () => {
    let result: Promise<void> | undefined;
    expect(() => { result = inBackground("t", () => { throw new Error("boom"); }); }).not.toThrow();
    await expect(result).resolves.toBeUndefined();
    expect(logged).toHaveBeenCalledTimes(1);
  });
});
