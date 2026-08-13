"use client";

import { useState } from "react";
import { fetchSmartPick } from "@/lib/api/smartPick";
import type { SmartPickRequestBody, SmartPick } from "@/types/smartPick";

export function useSmartPick() {
  const [picking, setPicking] = useState(false);
  const [pickSummary, setPickSummary] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(body: SmartPickRequestBody): Promise<SmartPick[]> {
    setPicking(true);
    setError(null);
    try {
      const data = await fetchSmartPick(body);
      setPickSummary(data.summary);
      return data.picks;
    } catch (e: unknown) {
      // Callers fall through to manual selection with nothing picked — but
      // surface why, so a real failure (bad API key, network blip) doesn't
      // look identical to "ZiGy just didn't select anything."
      setError(e instanceof Error ? e.message : "ZiGy couldn't get picks right now");
      return [];
    } finally {
      setPicking(false);
    }
  }

  return { picking, pickSummary, error, run };
}
