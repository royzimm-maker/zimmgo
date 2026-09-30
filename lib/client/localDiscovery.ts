import { extractApiErrorMessage } from "@/lib/utils";
import type { LocalDiscovery } from "@/types/localDiscovery";

export async function fetchLocalDiscovery(destination: string, cities: string[]): Promise<LocalDiscovery> {
  const params = new URLSearchParams({ destination });
  for (const city of cities) params.append("city", city);
  const res = await fetch(`/api/local-discovery?${params}`);
  if (!res.ok) throw new Error(extractApiErrorMessage(await res.text()));
  return res.json();
}
