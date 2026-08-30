"use client";

import { useEffect, useRef } from "react";
import { useTripStore, hasRealProgress } from "@/lib/store/tripStore";
import type { Trip } from "@/types/trip";

// Mirrors the exact shape tripStore.ts's own `partialize` persists to
// localStorage — this is the whole sync payload, both directions.
interface SyncBlob {
  trip: Trip;
  savedTrips: Trip[];
  chatMessages: ReturnType<typeof useTripStore.getState>["chatMessages"];
  progress: number;
  defaultDepartureAirport?: string;
  defaultBeliPref?: ReturnType<typeof useTripStore.getState>["defaultBeliPref"];
  defaultCurrency?: string;
}

function currentBlob(): SyncBlob {
  const s = useTripStore.getState();
  return {
    trip: s.trip,
    savedTrips: s.savedTrips,
    chatMessages: s.chatMessages,
    progress: s.progress,
    defaultDepartureAirport: s.defaultDepartureAirport,
    defaultBeliPref: s.defaultBeliPref,
    defaultCurrency: s.defaultCurrency,
  };
}

// No per-trip/blob timestamp is stored anywhere — every Trip already carries
// its own `updatedAt`, bumped by nearly every store setter, so freshness is
// derived from that instead of adding a new field just for this.
function newestUpdatedAt(blob: Pick<SyncBlob, "trip" | "savedTrips">): number {
  const all = [blob.trip, ...blob.savedTrips];
  return all.reduce((max, t) => Math.max(max, Date.parse(t.updatedAt) || 0), 0);
}

const DEBOUNCE_MS = 1500;

// Anonymous, device-linked backend sync — entirely additive on top of the
// existing localStorage persistence, not a replacement for it. Never blocks
// or throws into the UI: a failed sync (no DATABASE_URL configured yet, a
// network blip) just means this device keeps working off localStorage like
// it always has, silently retrying on the next change.
export function TripSyncProvider({ children }: { children: React.ReactNode }) {
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const hydratedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/trip-sync");
        if (!res.ok || cancelled) return;
        const { data } = (await res.json()) as { data: SyncBlob | null };
        if (!data) return; // nothing on the server yet — local stays authoritative

        const local = currentBlob();
        const shouldHydrate = !hasRealProgress(local.trip) || newestUpdatedAt(data) > newestUpdatedAt(local);
        if (shouldHydrate) {
          useTripStore.setState({
            trip: data.trip,
            savedTrips: data.savedTrips,
            chatMessages: data.chatMessages,
            progress: data.progress,
            defaultDepartureAirport: data.defaultDepartureAirport,
            defaultBeliPref: data.defaultBeliPref,
            defaultCurrency: data.defaultCurrency,
          });
        }
      } catch {
        // No backend configured yet, or offline — fine, localStorage still works.
      } finally {
        hydratedRef.current = true;
      }
    })();

    const unsubscribe = useTripStore.subscribe(() => {
      if (!hydratedRef.current) return; // don't sync the pre-merge state back out
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        fetch("/api/trip-sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(currentBlob()),
        }).catch(() => {
          // Non-fatal — same reasoning as above, this device just falls back
          // to localStorage-only until the next successful sync.
        });
      }, DEBOUNCE_MS);
    });

    return () => {
      cancelled = true;
      unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return <>{children}</>;
}
