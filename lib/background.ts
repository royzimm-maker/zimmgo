// Housekeeping a request kicks off but mustn't be affected by — the cleanup
// sweeps (old devices, rate-limit windows, finished jobs). Callers don't
// await it, and it can neither throw nor reject into them: a failure,
// synchronous or not, is only logged. The returned promise exists for tests.
export function inBackground(label: string, work: () => PromiseLike<unknown>): Promise<void> {
  const logFailure = (error: unknown) => console.error(`[${label}] background cleanup failed`, error);
  try {
    return Promise.resolve(work()).then(() => undefined, logFailure);
  } catch (error: unknown) {
    logFailure(error);
    return Promise.resolve();
  }
}
