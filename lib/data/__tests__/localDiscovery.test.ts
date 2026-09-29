// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "fs";
import { join, relative, sep } from "path";

// lib/data/localDiscovery.ts holds every destination's guide (~85 KB) and is
// served per destination by /api/local-discovery. Importing it anywhere else
// risks pulling all of it into the browser bundle again — so only the API
// route may. Types live in types/localDiscovery.ts.
const ROOT = join(__dirname, "..", "..", "..");
const ALLOWED = new Set(["app/api/local-discovery/route.ts"]);

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(full);
    return /\.(ts|tsx)$/.test(name) ? [full] : [];
  });
}

describe("local discovery data stays server-side", () => {
  it("is imported only by its API route", () => {
    const importers = ["app", "components", "lib"]
      .flatMap((d) => sourceFiles(join(ROOT, d)))
      .filter((f) => /from\s+["']@\/lib\/data\/localDiscovery["']/.test(readFileSync(f, "utf8")))
      .map((f) => relative(ROOT, f).split(sep).join("/"));

    expect(importers.filter((f) => !ALLOWED.has(f))).toEqual([]);
    expect(importers).toContain("app/api/local-discovery/route.ts");
  });
});
