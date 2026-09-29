"use client";

import { useEffect } from "react";
import { useTripStore, hasRealProgress } from "@/lib/store/tripStore";
import { mergeSyncBlobs, stableStringify, type SyncBlob } from "@/lib/sync/syncBlob";
import { SCHEMA_VERSION, migrateSyncBlob } from "@/lib/sync/schema";

function currentBlob(): SyncBlob {
  const s = useTripStore.getState();
  return {
    schemaVersion: SCHEMA_VERSION,
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
// Server copies are migrated to this code's SCHEMA_VERSION before use. If the
// server holds data from a *newer* version (a tab left open across a deploy),
// this tab stops syncing entirely rather than overwrite it with an older
// shape — reloading picks up the new code.
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
    // Set once this tab's code is known to be older than the saved data —
    // no more reads or writes until a reload.
    let outdated = false;

    function stopAsOutdated() {
      outdated = true;
      version = null;
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      console.warn("[trip-sync] Saved data is from a newer version of ZimmGo — sync paused until reload.");
    }

    function schedulePush(delay = DEBOUNCE_MS) {
      if (version === null || cancelled || outdated) return;
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(push, delay);
    }

    async function push() {
      if (version === null || cancelled || outdated) return;
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
          const server = migrateSyncBlob(body.data);
          if (server.status === "too-new") {
            stopAsOutdated();
            return;
          }
          version = body.version;
          if (server.status === "ok") {
            lastSyncedJson = stableStringify(body.data);
            const merged = mergeSyncBlobs(currentBlob(), server.blob);
            if (stableStringify(merged) !== stableStringify(currentBlob())) applyBlob(merged);
          } else {
            lastSyncedJson = null; // unusable server copy — ours replaces it
          }
          pending = true; // write the merged result on top of the new version
        } else if (res.status === 422) {
          // The server rejected our schema version — it's running older code
          // than this tab (e.g. mid-rollback). Retrying won't help.
          stopAsOutdated();
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
      if (hydrating || version !== null || outdated) return;
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

            const migrated = body.data == null ? null : migrateSyncBlob(body.data);
            if (migrated?.status === "too-new") {
              stopAsOutdated();
              return;
            }
            const server = migrated?.status === "ok" ? migrated.blob : null;
            const local = currentBlob();
            // Compared against what the server literally holds, so a copy
            // saved in an older schema gets rewritten once in the current one.
            lastSyncedJson = server ? stableStringify(body.data) : null;
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
