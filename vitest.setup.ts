import "@testing-library/jest-dom/vitest";

// jsdom doesn't implement scrollTo — StepShell calls it on every mount.
window.scrollTo = () => {};
