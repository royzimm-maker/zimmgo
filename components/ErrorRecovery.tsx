"use client";

import { useEffect, useState } from "react";
import { useTripStore } from "@/lib/store/tripStore";

// Shown when rendering crashes: full-page by app/error.tsx and
// app/global-error.tsx, and inline (header and chat still usable) by the
// planning flow's per-step ErrorBoundary.
// Trips are persisted (localStorage + server sync), so a trip whose data
// trips a rendering bug would otherwise crash again on every reload — and on
// every device it syncs to. "Start a fresh trip" is the way out that loses
// nothing: the current trip is shelved in My Saved Trips, untouched, and a
// blank one takes its place.
//
// Deliberately built from plain elements rather than the app's shared UI
// components, so a bug in one of those can't take the recovery screen down too.
export function ErrorRecovery({
  error,
  reset,
  inline = false,
}: {
  error: Error & { digest?: string };
  reset: () => void;
  inline?: boolean;
}) {
  const [shelved, setShelved] = useState(false);

  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  function startFresh() {
    try {
      useTripStore.getState().startNewTrip();
      setShelved(true);
    } catch (e) {
      console.error("[app error] couldn't shelve the current trip", e);
    }
    // A full reload rather than reset(): every component starts clean on the
    // new, empty trip. The store has already saved it to localStorage.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- a full reload is the point: nothing from the crashed render survives
    window.location.assign("/plan");
  }

  return (
    <div className={inline ? "flex justify-center py-10" : "flex min-h-screen items-center justify-center bg-slate-50 px-4"}>
      <div role="alert" className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-slate-800">Something went wrong</h1>
        <p className="mt-2 text-sm text-slate-600">
          ZimmGo hit an unexpected error showing this {inline ? "step" : "page"}. Your trips are still saved.
        </p>

        <div className="mt-5 flex flex-col gap-2">
          <button
            type="button"
            onClick={reset}
            className="w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={startFresh}
            disabled={shelved}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            Start a fresh trip
          </button>
          <p className="text-xs text-slate-500">
            If trying again keeps failing, start a fresh trip — the one you were working on is kept in
            My Saved Trips, nothing is deleted.
          </p>
          {/* A plain link on purpose: a full page load leaves the crashed app state behind. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" className="mt-1 text-center text-xs text-slate-500 underline hover:text-slate-700">
            Back to the home page
          </a>
        </div>

        {error.digest && (
          <p className="mt-4 text-[11px] text-slate-400">Error reference: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
