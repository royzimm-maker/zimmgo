"use client";

import { useEffect } from "react";
import { useTripStore, hasRealProgress } from "@/lib/store/tripStore";
import { isSyncBlob, mergeSyncBlobs, stableStringify, type SyncBlob } from "@/lib/sync/syncBlob";

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

function applyBlob(b: SyncBlob) {
  useTripStore.setState({
    trip: b.trip,
    savedTrips: b.savedTrips,
    chatMessages: b.chatMessages,
    progress: b.progress,
    defaultDepartureAirport: b.defaultDepartureAirport,
    defaultBeliPref: b.defaultBeliPref,
    defaultCurrency: b.defaultCurrency,
  });
}

export const DEBOUNCE_MS = 1500;
// Delays before each GET attempt. After the last one fails, hydration is
// retried only when the window regains focus or comes back online.
export const HYDRATE_RETRY_DELAYS_MS = [0, 2_000, 5_000, 15_000];
const PUT_RETRY_MS = 10_000;

// Anonymous, device-linked backend sync, layered on top of localStorage
// persistence rather than replacing it. Two safety rules:
//
// 1. Nothing is ever PUT until a GET has actually succeeded. If the first
//    GET failed (offline, blip, no DB) and we pushed anyway, a device whose
//    localStorage had just been cleared would overwrite its full server copy
//    with an empty trip — the exact loss persistence exists to prevent.
// 2. Every PUT carries the version it was based on. If another tab saved in
//    between, the server rejects it (409) with its copy; we merge trip by
//    trip and retry, rather than one tab blindly clobbering the other.
//
// Failures never surface in the UI — the device just keeps working off
// localStorage and syncs once the backend is reachable.
export function TripSyncProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    let cancelled = false;
    // null = not hydrated yet; no PUTs allowed.
    let version: number | null = null;
    // JSON of the blob the server is known to hold — pushes of identical
    // content are skipped, so hydration itself never triggers a write.
    let lastSyncedJson: string | null = null;
    let hydrating = false;
    let inFlight = false;
    let pending = false;
    let debounceTimer: ReturnType<typeof setTimeout> | undefined;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;

    function schedulePush(delay = DEBOUNCE_MS) {
      if (version === null || cancelled) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(push, delay);
    }

    async function push() {
      if (version === null || cancelled) return;
      if (inFlight) {
        pending = true;
        return;
      }
      const blob = currentBlob();
      const json = stableStringify(blob);
      if (json === lastSyncedJson) return;

      inFlight = true;
      try {
        const res = await fetch("/api/trip-sync", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ baseVersion: version, data: blob }),
        });
        if (cancelled) return;
        if (res.ok) {
          const body = (await res.json()) as { version: number };
          version = body.version;
          lastSyncedJson = json;
        } else if (res.status === 409) {
          const body = (await res.json()) as { data: unknown; version: number };
          version = body.version;
          if (isSyncBlob(body.data)) {
            lastSyncedJson = stableStringify(body.data);
            const merged = mergeSyncBlobs(currentBlob(), body.data);
            if (stableStringify(merged) !== stableStringify(currentBlob())) applyBlob(merged);
          } else {
            lastSyncedJson = null; // unusable server copy — ours replaces it
          }
          pending = true; // write the merged result on top of the new version
        } else {
          clearTimeout(retryTimer);
          retryTimer = setTimeout(push, PUT_RETRY_MS);
        }
      } catch {
        clearTimeout(retryTimer);
        retryTimer = setTimeout(push, PUT_RETRY_MS);
      } finally {
        inFlight = false;
        if (pending && !cancelled) {
          pending = false;
          push();
        }
      }
    }

    async function hydrate() {
      if (hydrating || version !== null) return;
      hydrating = true;
      try {
        for (const delay of HYDRATE_RETRY_DELAYS_MS) {
          if (delay) await new Promise((r) => setTimeout(r, delay));
          if (cancelled) return;
          try {
            const res = await fetch("/api/trip-sync");
            if (!res.ok) continue;
            const body = (await res.json()) as { data: unknown; version?: number };
            if (cancelled) return;

            const server = isSyncBlob(body.data) ? body.data : null;
            const local = currentBlob();
            lastSyncedJson = server ? stableStringify(server) : null;
            version = body.version ?? 0;

            if (server) {
              const next = hasRealProgress(local.trip) ? mergeSyncBlobs(local, server) : server;
              if (stableStringify(next) !== stableStringify(local)) applyBlob(next);
            }
            // Local may hold work the server hasn't seen — push once now that
            // it's safe to. push() skips it if the content already matches,
            // and a brand-new visitor with an untouched blank trip has
            // nothing worth saving yet.
            if (server || hasRealProgress(local.trip)) schedulePush();
            return;
          } catch {
            // network error — fall through to the next attempt
          }
        }
      } finally {
        hydrating = false;
      }
    }

    const unsubscribe = useTripStore.subscribe(() => schedulePush());
    const onReconnect = () => hydrate();
    window.addEventListener("focus", onReconnect);
    window.addEventListener("online", onReconnect);
    hydrate();

    return () => {
      cancelled = true;
      unsubscribe();
      window.removeEventListener("focus", onReconnect);
      window.removeEventListener("online", onReconnect);
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
    };
  }, []);

  return <>{children}</>;
}
