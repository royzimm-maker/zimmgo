"use client";

import { useState } from "react";
import { fetchSmartPick } from "@/lib/api/smartPick";
import type { SmartPickRequestBody, SmartPick } from "@/types/smartPick";

export function useSmartPick() {
  const [picking, setPicking] = useState(false);
  const [pickSummary, setPickSummary] = useState<string | null>(null);

  async function run(body: SmartPickRequestBody): Promise<SmartPick[]> {
    setPicking(true);
    try {
      const data = await fetchSmartPick(body);
      setPickSummary(data.summary);
      return data.picks;
    } catch {
      // Swallow — callers fall through to manual selection with nothing picked.
      return [];
    } finally {
      setPicking(false);
    }
  }

  return { picking, pickSummary, run };
}
