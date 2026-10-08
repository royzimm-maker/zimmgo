"use client";

import { useState } from "react";

// Running/error state for work a button kicks off (a search, a ZimmGo pick).
// A failure is shown rather than swallowed, so a real error (bad API key,
// network blip) doesn't look the same as "nothing found".
export function useAsyncTask(fallbackError: string) {
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(work: () => Promise<void>): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      await work();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : fallbackError);
    } finally {
      setRunning(false);
    }
  }

  return { running, error, run };
}

// A ZimmGo pick made per city, remembering ZimmGo's reason for each city.
export function useCityPick(fallbackError: string) {
  const task = useAsyncTask(fallbackError);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  function run(city: string, pick: () => Promise<string | undefined>): Promise<void> {
    return task.run(async () => {
      const reason = await pick();
      if (reason !== undefined) setReasons((prev) => ({ ...prev, [city]: reason }));
    });
  }

  return { running: task.running, error: task.error, reasons, run };
}
