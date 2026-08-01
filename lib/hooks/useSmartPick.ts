"use client";

import { useState } from "react";
import { fetchSmartPick } from "@/lib/api/smartPick";
import type { SmartPickRequestBody, SmartPick } from "@/types/smartPick";

export function useSmartPick() {
  const [picking, setPicking] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);

  async function run(body: SmartPickRequestBody): Promise<SmartPick[]> {
    setPicking(true);
    try {
      const data = await fetchSmartPick(body);
      setSummary(data.summary);
      return data.picks;
    } catch {
      return [];
    } finally {
      setPicking(false);
    }
  }

  return { picking, summary, run };
}
