import "@testing-library/jest-dom/vitest";

// A per-file `// @vitest-environment node` override (e.g. API route tests
// that need real Request/Response semantics) still runs this global setup
// file, but has no `window` — guard the jsdom-only bit below.
// jsdom doesn't implement scrollTo — StepShell calls it on every mount.
if (typeof window !== "undefined") {
  window.scrollTo = () => {};
}
