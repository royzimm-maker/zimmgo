"use client";

import { useState } from "react";

// Every key ZimmGo keeps in this browser starts with "zimmgo" — trips, pending
// jobs, recent destination searches and panel sizing.
export function clearZimmGoLocalStorage() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith("zimmgo")) keys.push(key);
    }
    keys.forEach((key) => localStorage.removeItem(key));
  } catch {
    // storage unavailable — nothing stored here to clear
  }
}

// Deletes this device's synced copy on the server, then everything ZimmGo
// keeps in this browser, then reloads so nothing in memory writes it back.
export function DeleteMyData() {
  const [stage, setStage] = useState<"idle" | "confirming" | "deleting" | "error">("idle");

  async function deleteEverything() {
    setStage("deleting");
    try {
      const res = await fetch("/api/trip-sync", { method: "DELETE" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      clearZimmGoLocalStorage();
      // A full reload, not router navigation: the trip store still holds the
      // data in memory, and a client-side transition would let it save back.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign("/");
    } catch {
      setStage("error");
    }
  }

  if (stage === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStage("confirming")}
        className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
      >
        Delete my trips and data
      </button>
    );
  }

  return (
    <div role="alertdialog" aria-label="Confirm deleting your data" className="rounded-lg border border-red-200 bg-red-50 p-4">
      <p className="text-sm font-medium text-red-800">Delete all your ZimmGo trips?</p>
      <p className="mt-1 text-xs text-red-700">
        This removes every trip, itinerary and chat from this browser and from ZimmGo&apos;s database. It can&apos;t be
        undone. Close any other ZimmGo tabs first, or they may save their copy again.
      </p>
      {stage === "error" && (
        <p className="mt-2 text-xs font-medium text-red-800">Couldn&apos;t delete right now — nothing was removed. Please try again.</p>
      )}
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={deleteEverything}
          disabled={stage === "deleting"}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
        >
          {stage === "deleting" ? "Deleting…" : "Yes, delete everything"}
        </button>
        <button
          type="button"
          onClick={() => setStage("idle")}
          disabled={stage === "deleting"}
          className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
