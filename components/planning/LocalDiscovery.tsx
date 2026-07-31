"use client";

import { useMemo, useState } from "react";
import {
  Music, Sparkles, Smartphone, ChevronDown, ChevronUp,
  ExternalLink, MapPin, Bus, Ticket,
} from "lucide-react";
import { getLocalDiscovery } from "@/lib/data/localDiscovery";
import type { TripPreferences } from "@/types/trip";

interface Props {
  preferences: TripPreferences;
}

type Tab = "scene" | "music" | "apps" | "transfers";

const TABS: { id: Tab; label: string; emoji: string }[] = [
  { id: "scene",     label: "Local Scene",       emoji: "🎪" },
  { id: "music",     label: "Music",             emoji: "🎵" },
  { id: "apps",      label: "Essential Apps",    emoji: "📱" },
  { id: "transfers", label: "Airport Transfers", emoji: "✈️" },
];

export function LocalDiscovery({ preferences }: Props) {
  const [open, setOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("scene");

  const destName  = preferences.destination?.displayName ?? "";
  const cityCount = preferences.destination?.cities?.length ?? 1;
  const discovery = useMemo(() => getLocalDiscovery(destName, cityCount), [destName, cityCount]);

  return (
    <div className="rounded-xl border border-brand-200 bg-white overflow-hidden">
      {/* Header toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-brand-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles size={15} className="text-brand-500" />
          <div>
            <span className="text-sm font-semibold text-slate-800">Local Discovery</span>
            <span className="ml-2 text-xs text-slate-400">— the inside track on {discovery.destination}</span>
          </div>
        </div>
        {open ? <ChevronUp size={14} className="text-slate-400 shrink-0" /> : <ChevronDown size={14} className="text-slate-400 shrink-0" />}
      </button>

      {open && (
        <>
          {/* Intro */}
          <div className="px-4 pt-1 pb-3 border-t border-brand-100 bg-gradient-to-br from-brand-50 to-slate-50">
            <p className="text-xs text-slate-600 leading-relaxed italic">{discovery.sceneIntro}</p>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-slate-100 overflow-x-auto">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-all ${
                  activeTab === tab.id
                    ? "border-brand-500 text-brand-700"
                    : "border-transparent text-slate-500 hover:text-slate-700"
                }`}
              >
                <span>{tab.emoji}</span>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="p-4">
            {activeTab === "scene" && <SceneTab discovery={discovery} />}
            {activeTab === "music" && <MusicTab discovery={discovery} />}
            {activeTab === "apps" && <AppsTab discovery={discovery} />}
            {activeTab === "transfers" && <TransfersTab discovery={discovery} />}
          </div>
        </>
      )}
    </div>
  );
}

// ── Scene tab ────────────────────────────────────────────────────────────────

function SceneTab({ discovery }: { discovery: ReturnType<typeof getLocalDiscovery> }) {
  const { events, hiddenGems } = discovery;

  return (
    <div className="flex flex-col gap-4">
      {events.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            <Ticket size={10} className="inline mr-1" />What&apos;s happening — and where the locals go
          </p>
          <div className="flex flex-col gap-3">
            {events.map((ev) => (
              <div key={ev.name} className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">{ev.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-slate-800">{ev.name}</p>
                    <EventTypeBadge type={ev.type} />
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{ev.description}</p>
                  {ev.tipNote && (
                    <p className="mt-1 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 leading-snug">
                      💡 {ev.tipNote}
                    </p>
                  )}
                  {ev.url && (
                    <a href={ev.url} target="_blank" rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline">
                      More info <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {hiddenGems.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            <MapPin size={10} className="inline mr-1" />Hidden gems — the stuff that didn&apos;t make the guidebook
          </p>
          <div className="flex flex-col gap-3">
            {hiddenGems.map((gem) => (
              <div key={gem.name} className="flex gap-3">
                <span className="text-xl shrink-0 mt-0.5">{gem.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-slate-800">{gem.name}</p>
                  <p className="text-xs text-slate-600 leading-relaxed mt-0.5">{gem.description}</p>
                  {gem.sourceUrl && (
                    <a href={gem.sourceUrl} target="_blank" rel="noreferrer"
                      className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline">
                      Read more <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Music tab ────────────────────────────────────────────────────────────────

function MusicTab({ discovery }: { discovery: ReturnType<typeof getLocalDiscovery> }) {
  const { music } = discovery;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-600 leading-relaxed italic">{music.intro}</p>

      {music.artists.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            <Music size={10} className="inline mr-1" />Artists worth knowing before you go
          </p>
          <div className="flex flex-col gap-3">
            {music.artists.map((artist) => (
              <div key={artist.name} className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                  <Music size={13} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-xs font-semibold text-slate-800">{artist.name}</p>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-medium text-slate-500">
                      {artist.genre}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed mt-0.5">{artist.why}</p>
                  <a href={artist.searchUrl} target="_blank" rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline">
                    Listen on Spotify <ExternalLink size={9} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {music.venues.length > 0 && (
        <div className="border-t border-slate-100 pt-4">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
            Where to hear it live
          </p>
          <div className="flex flex-col gap-2">
            {music.venues.map((venue) => (
              <div key={venue.name} className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-slate-800">{venue.name}</p>
                  <span className="shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-medium text-brand-700">
                    {venue.genre}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{venue.vibe}</p>
                {venue.url && (
                  <a href={venue.url} target="_blank" rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline">
                    Website <ExternalLink size={9} />
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <a
        href={music.playlistSearchUrl}
        target="_blank"
        rel="noreferrer"
        className="flex items-center justify-center gap-2 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-xs font-medium text-brand-700 hover:bg-brand-100 transition-colors"
      >
        <span>🎧</span>
        Find local playlists on Spotify
        <ExternalLink size={10} />
      </a>
    </div>
  );
}

// ── Apps tab ────────────────────────────────────────────────────────────────

const APP_CATEGORY_LABELS: Record<string, string> = {
  transit: "Getting Around",
  taxi: "Taxis & Rideshare",
  food: "Eating & Booking",
  payment: "Payment",
  language: "Language",
  events: "What's On",
  maps: "Navigation",
};

function AppsTab({ discovery }: { discovery: ReturnType<typeof getLocalDiscovery> }) {
  const { apps } = discovery;

  const grouped = useMemo(
    () => apps.reduce<Record<string, typeof apps>>((acc, app) => {
      const key = APP_CATEGORY_LABELS[app.category] ?? app.category;
      if (!acc[key]) acc[key] = [];
      acc[key].push(app);
      return acc;
    }, {}),
    [apps]
  );

  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs text-slate-500 leading-relaxed">
        Apps that&apos;ll make you look like a local — download these before you lose Wi-Fi.
      </p>
      {Object.entries(grouped).map(([category, categoryApps]) => (
        <div key={category}>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2">
            <Smartphone size={10} className="inline mr-1" />{category}
          </p>
          <div className="flex flex-col gap-2">
            {categoryApps.map((app) => (
              <div key={app.name} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2.5">
                <span className="text-lg shrink-0">{app.emoji}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-slate-800">{app.name}</p>
                    <span className="text-[9px] text-slate-400">{app.platform === "both" ? "iOS & Android" : app.platform}</span>
                  </div>
                  <p className="text-[11px] text-slate-500 leading-snug mt-0.5">{app.description}</p>
                  <a href={app.url} target="_blank" rel="noreferrer"
                    className="mt-1 inline-flex items-center gap-0.5 text-[11px] text-brand-500 hover:underline">
                    Get it <ExternalLink size={9} />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Transfers tab ────────────────────────────────────────────────────────────

function TransfersTab({ discovery }: { discovery: ReturnType<typeof getLocalDiscovery> }) {
  const { airportTransfers } = discovery;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-slate-500 leading-relaxed">
        How to get from the airport without overpaying or making a rookie mistake.
      </p>
      {airportTransfers.map((transfer) => (
        <div
          key={transfer.option}
          className={`rounded-lg border px-3 py-3 ${
            transfer.recommended
              ? "border-sage-300 bg-sage-50"
              : "border-slate-200 bg-white"
          }`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">{transfer.emoji}</span>
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-xs font-semibold text-slate-800">{transfer.option}</p>
                  {transfer.recommended && (
                    <span className="rounded-full bg-sage-200 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sage-800">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-0.5">
                  <span className="text-[11px] text-slate-500"><Bus size={9} className="inline mr-0.5" />{transfer.timeEst}</span>
                  <span className="text-[11px] font-medium text-slate-700">{transfer.costEst}</span>
                </div>
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed mt-2">{transfer.description}</p>
          {transfer.tip && (
            <p className="mt-2 text-[11px] text-amber-700 bg-amber-50 rounded px-2 py-1 leading-snug">
              💡 {transfer.tip}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Event type badge ─────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, string> = {
  music:    "bg-purple-100 text-purple-700",
  theater:  "bg-pink-100 text-pink-700",
  dance:    "bg-rose-100 text-rose-700",
  market:   "bg-amber-100 text-amber-700",
  festival: "bg-orange-100 text-orange-700",
  literary: "bg-blue-100 text-blue-700",
  art:      "bg-teal-100 text-teal-700",
  food:     "bg-green-100 text-green-700",
  sport:    "bg-slate-100 text-slate-600",
};

const TYPE_LABELS: Record<string, string> = {
  music: "Music", theater: "Theatre", dance: "Dance", market: "Market",
  festival: "Festival", literary: "Literary", art: "Arts", food: "Food", sport: "Sport",
};

function EventTypeBadge({ type }: { type: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${TYPE_STYLES[type] ?? "bg-slate-100 text-slate-600"}`}>
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}
