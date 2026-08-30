"use client";

import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";

// Self-contained: saves to the store immediately on connect/disconnect rather
// than waiting for the host step's Continue button, so it can be dropped into
// whichever step makes sense without wiring into that step's handleContinue.
export function BeliConnect() {
  const { trip, setBeliPref, defaultBeliPref } = useTripStore();
  const existing = trip.preferences.beliPref;
  // Falls back to the remembered connection from a previous trip when this
  // trip hasn't set one yet, so returning users don't have to reconnect.
  const [beliUsername, setBeliUsername] = useState(existing?.username ?? defaultBeliPref?.username ?? "");
  const [beliConnected, setBeliConnectedState] = useState(existing?.connected ?? defaultBeliPref?.connected ?? false);

  // The fallback above is cosmetic only — write it into this trip's own
  // preferences too, otherwise restaurant generation (which reads
  // trip.preferences.beliPref directly) wouldn't actually use it despite the
  // UI showing "Connected".
  useEffect(() => {
    if (!existing && defaultBeliPref) setBeliPref(defaultBeliPref);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function connect() {
    // Strip a leading "@" if the user typed one themselves — the display
    // below always prepends its own "@", so a stored "@royzimm" would
    // otherwise render as "@@royzimm".
    const username = beliUsername.trim().replace(/^@+/, "");
    setBeliUsername(username);
    setBeliConnectedState(true);
    setBeliPref({ connected: true, username });
  }
  function disconnect() {
    setBeliConnectedState(false);
    setBeliPref({ connected: false });
  }

  return (
    <div className="border-t border-slate-100 pt-5">
      <p className="mb-1 text-sm font-medium text-slate-700">Restaurant discovery</p>
      <p className="mb-2.5 text-xs text-slate-400">
        Connect your Beli account and ZiGy will lean on your own rankings and bookmarks when picking restaurants — not just star ratings.
      </p>
      {beliConnected ? (
        <div className="flex items-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-3 py-2">
          <Check size={14} className="text-brand-600 shrink-0" />
          <p className="text-xs text-brand-700 flex-1">
            Connected as <span className="font-semibold">@{beliUsername.replace(/^@+/, "")}</span>
          </p>
          <button
            type="button"
            onClick={disconnect}
            className="text-xs text-slate-400 hover:text-slate-600 font-medium"
          >
            Disconnect
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={beliUsername}
            onChange={(e) => setBeliUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && beliUsername.trim() && connect()}
            placeholder="Your Beli username (optional)"
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
          <button
            type="button"
            onClick={connect}
            disabled={!beliUsername.trim()}
            className="rounded-lg bg-brand-600 text-white px-3 py-1.5 text-xs font-semibold hover:bg-brand-700 disabled:opacity-40 transition-colors"
          >
            Connect
          </button>
        </div>
      )}
    </div>
  );
}
