// @vitest-environment node
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync, existsSync } from "fs";
import { join, relative, sep } from "path";

// Where code runs is decided by what imports it, so the folders say it:
//   lib/client — browser helpers that call this app's API routes
//   lib/search — server-side search providers (mock inventory)
//   lib/http   — helpers for API route handlers
// These tests follow every (non-type) import chain and fail if browser code
// can reach server-only code — which would ship it, and anything it holds,
// to every visitor — or if a route handler imports a browser helper.
const ROOT = join(__dirname, "..", "..");

const SERVER_ONLY_DIRS = ["lib/search/", "lib/http/", "lib/ai/", "lib/docx/"];
const SERVER_ONLY_FILES = [
  "lib/db.ts",
  "lib/rateLimit.ts",
  "lib/itinerary/runGeneration.ts",
  "lib/itinerary/generationJobs.ts",
  "lib/data/localDiscovery.ts", // every destination's guide — served per destination instead
  "lib/sync/retention.ts",
];
const isServerOnly = (f: string) => SERVER_ONLY_DIRS.some((d) => f.startsWith(d)) || SERVER_ONLY_FILES.includes(f);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir)).flatMap((name) => {
    const rel = `${dir}/${name}`;
    if (statSync(join(ROOT, rel)).isDirectory()) return name === "__tests__" || name === "node_modules" ? [] : sourceFiles(rel);
    return /\.(ts|tsx)$/.test(name) ? [rel] : [];
  });
}

const files = [...["app", "components", "lib", "types"].flatMap(sourceFiles), "proxy.ts"];
const resolve = (spec: string) => {
  const base = spec.replace(/^@\//, "");
  return [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`].find((c) => existsSync(join(ROOT, c)));
};
// Value imports only — `import type` is erased and ships nothing.
const importsOf = new Map(
  files.map((f) => {
    const src = readFileSync(join(ROOT, f), "utf8");
    const deps = [...src.matchAll(/^import\s+(?!type\s)[^'"]*?from\s+["'](@\/[^"']+)["']/gm)]
      .map((m) => resolve(m[1]))
      .filter((d): d is string => Boolean(d));
    return [f, deps];
  })
);
const isClientFile = (f: string) => /^\s*["']use client["']/.test(readFileSync(join(ROOT, f), "utf8"));

// The first import chain from `root` to a file matching `target`, if any.
function chainTo(root: string, target: (f: string) => boolean): string[] | null {
  const queue: string[][] = [[root]];
  const seen = new Set([root]);
  while (queue.length) {
    const path = queue.shift()!;
    for (const dep of importsOf.get(path[path.length - 1]) ?? []) {
      if (target(dep)) return [...path, dep];
      if (!seen.has(dep)) { seen.add(dep); queue.push([...path, dep]); }
    }
  }
  return null;
}

describe("module boundaries", () => {
  it("no browser code can reach server-only code", () => {
    const leaks = files.filter(isClientFile)
      .map((f) => chainTo(f, isServerOnly))
      .filter((c): c is string[] => c !== null)
      .map((c) => c.join(" → "));
    expect(leaks).toEqual([]);
  });

  it("API routes don't import browser helpers", () => {
    const routes = files.filter((f) => /^app\/api\/.*route\.ts$/.test(f) || f === "proxy.ts");
    const misuse = routes
      .map((f) => chainTo(f, (d) => d.startsWith("lib/client/")))
      .filter((c): c is string[] => c !== null)
      .map((c) => c.join(" → "));
    expect(misuse).toEqual([]);
  });

  it("the old mixed lib/api folder is gone", () => {
    expect(existsSync(join(ROOT, "lib", "api"))).toBe(false);
    expect(files.map((f) => f.split(sep).join("/")).filter((f) => relative(ROOT, f).startsWith("lib/api"))).toEqual([]);
  });
});
