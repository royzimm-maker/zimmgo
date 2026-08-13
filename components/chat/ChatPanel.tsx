"use client";

import { useEffect, useRef, useState } from "react";
import { Send, Sparkles, User, CheckCircle2 } from "lucide-react";
import { useTripStore } from "@/lib/store/tripStore";
import { cn } from "@/lib/utils";
import { GENERAL as ACTIVITY_CATEGORIES } from "@/components/planning/steps/ActivitiesStep";
import { VIBES } from "@/components/planning/steps/VibeStep";
import { ALLIANCES, CABIN_LABELS } from "@/components/planning/steps/AirlinesStep";
import type { LodgingType, AirlineAlliance, AirlinePreference, VibeTag } from "@/types/trip";

interface LodgingUpdatePayload {
  types?: LodgingType[];
  minStars?: 3 | 4 | 5;
  amenities?: string[];
  otherAmenity?: string;
}

// Deterministic client-side summary, rather than trusting the model to
// produce a consistently-shaped label — the tool's own "reply" field is
// free-text conversation, this is a compact chip naming exactly what changed.
function summarizeLodgingUpdate(u: LodgingUpdatePayload): string {
  const parts: string[] = [];
  if (u.types?.length) parts.push(`Type → ${u.types.join(", ")}`);
  if (u.minStars) parts.push(`${u.minStars}★ minimum`);
  if (u.amenities?.length) parts.push(`Amenities → ${u.amenities.join(", ")}`);
  if (u.otherAmenity) parts.push(`+ ${u.otherAmenity}`);
  return parts.length ? `Updated lodging: ${parts.join(" · ")}` : "Updated lodging preferences";
}

function activityLabel(id: string): string {
  return ACTIVITY_CATEGORIES.find((c) => c.id === id)?.label ?? id;
}

// Diff-based, for the same reason as summarizeLodgingUpdate above — a
// consistent label the UI controls, not something left to model prose.
function summarizeActivityUpdate(oldList: string[], newList: string[]): string {
  const added = newList.filter((a) => !oldList.includes(a)).map(activityLabel);
  const removed = oldList.filter((a) => !newList.includes(a)).map(activityLabel);
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${added.join(", ")}`);
  if (removed.length) parts.push(`− ${removed.join(", ")}`);
  return parts.length ? `Updated activities: ${parts.join(" · ")}` : "Updated activities";
}

function vibeLabel(id: string): string {
  return VIBES.find((v) => v.id === id)?.label ?? id;
}

function summarizeVibeUpdate(oldList: string[], newList: string[]): string {
  const added = newList.filter((v) => !oldList.includes(v)).map(vibeLabel);
  const removed = oldList.filter((v) => !newList.includes(v)).map(vibeLabel);
  const parts: string[] = [];
  if (added.length) parts.push(`+ ${added.join(", ")}`);
  if (removed.length) parts.push(`− ${removed.join(", ")}`);
  return parts.length ? `Updated vibe: ${parts.join(" · ")}` : "Updated vibe";
}

interface AirlineUpdatePayload {
  airlines?: string[];
  alliances?: AirlineAlliance[];
  preferNonstop?: boolean;
  cabinClasses?: string[];
  prioritizeLowestFare?: boolean;
}

function summarizeAirlineUpdate(u: AirlineUpdatePayload): string {
  if (u.prioritizeLowestFare) return "Updated flights: lowest fares, any airline";
  const parts: string[] = [];
  if (u.airlines?.length) parts.push(`Airlines → ${u.airlines.join(", ")}`);
  if (u.alliances?.length) {
    parts.push(`Alliances → ${u.alliances.map((a) => ALLIANCES.find((x) => x.id === a)?.label ?? a).join(", ")}`);
  }
  if (u.cabinClasses?.length) parts.push(`Cabin → ${u.cabinClasses.map((c) => CABIN_LABELS[c] ?? c).join(", ")}`);
  if (u.preferNonstop !== undefined) parts.push(u.preferNonstop ? "Nonstop preferred" : "Connections OK");
  return parts.length ? `Updated flights: ${parts.join(" · ")}` : "Updated flight preferences";
}

const STARTER_PROMPTS = [
  "What's the best time of year to visit?",
  "What should I pack for this trip?",
  "Any local customs I should know?",
  "What are the must-eat dishes?",
  "Can you swap a day for something more adventurous?",
  "Add a free day with local recommendations.",
  "What hidden gems should I not miss?",
];

export function ChatPanel() {
  const { trip, chatMessages, addMessage, addWanderlogItem, setLodging, setActivities, setVibes, setAirlines } = useTripStore();
  const [input,   setInput  ] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const latestItinerary = trip.itineraries[trip.itineraries.length - 1] ?? null;

  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Welcome message on first load
  const hasMessages = chatMessages.length > 0;

  async function sendMessage(text: string) {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    addMessage({ role: "user", content: trimmed, stepContext: trip.currentStep });
    setLoading(true);

    try {
      const itineraryContext = latestItinerary
        ? {
            activities: latestItinerary.activities.map((a) => a.name),
            restaurants: (latestItinerary.restaurants ?? []).map((r) => r.name),
          }
        : undefined;

      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          history: chatMessages,
          preferences: trip.preferences,
          itineraryContext,
          stepContext: trip.currentStep,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      if (latestItinerary && Array.isArray(data.wanderlogItems)) {
        for (const item of data.wanderlogItems) {
          addWanderlogItem(latestItinerary.id, {
            label: item.label,
            source: item.source,
            location: item.location,
            description: item.description,
          });
        }
      }

      let preferenceUpdateSummary: string | undefined;
      if (data.lodgingUpdate) {
        const update: LodgingUpdatePayload = data.lodgingUpdate;
        const existing = trip.preferences.lodging;
        const amenities = update.amenities ?? existing?.amenities ?? [];
        const mergedAmenities = update.otherAmenity && !amenities.includes(update.otherAmenity)
          ? [...amenities, update.otherAmenity]
          : amenities;
        setLodging({
          types: update.types ?? existing?.types ?? [],
          minStars: update.minStars ?? existing?.minStars ?? 4,
          amenities: mergedAmenities,
        });
        preferenceUpdateSummary = summarizeLodgingUpdate(update);
      }
      if (Array.isArray(data.activityUpdate)) {
        const newActivities: string[] = data.activityUpdate;
        preferenceUpdateSummary = summarizeActivityUpdate(trip.preferences.activities, newActivities);
        setActivities(newActivities);
      }
      if (Array.isArray(data.vibeUpdate)) {
        const newVibes: string[] = data.vibeUpdate;
        preferenceUpdateSummary = summarizeVibeUpdate(trip.preferences.vibes, newVibes);
        setVibes(newVibes as VibeTag[]);
      }
      if (data.airlineUpdate) {
        const update: AirlineUpdatePayload = data.airlineUpdate;
        const existing = trip.preferences.airlinePrefs;
        const lowestFare = update.prioritizeLowestFare ?? existing?.prioritizeLowestFare ?? false;
        const cabinClasses = update.cabinClasses ?? existing?.cabinClasses ?? [];
        setAirlines(
          lowestFare
            ? { airlines: [], alliances: [], preferNonstop: false, cabinClass: "economy", cabinClasses: [], prioritizeLowestFare: true }
            : {
                airlines: update.airlines ?? existing?.airlines ?? [],
                alliances: update.alliances ?? existing?.alliances ?? [],
                preferNonstop: update.preferNonstop ?? existing?.preferNonstop ?? true,
                cabinClass: (cabinClasses[0] ?? "economy") as AirlinePreference["cabinClass"],
                cabinClasses,
                prioritizeLowestFare: false,
              }
        );
        preferenceUpdateSummary = summarizeAirlineUpdate(update);
      }

      addMessage({ role: "assistant", content: data.reply, stepContext: trip.currentStep, preferenceUpdateSummary });
    } catch {
      addMessage({
        role: "assistant",
        content: "Sorry, I had trouble connecting. Please try again.",
        stepContext: trip.currentStep,
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-slate-200 px-4 py-3 hidden lg:block">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
            <Sparkles size={13} className="text-brand-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">ZiGy</p>
            <p className="text-xs text-slate-400">Your personal AI travel advisor</p>
          </div>
        </div>
      </div>

      {/* Input — pinned just below the header */}
      <div className="shrink-0 border-b border-slate-200 p-3">
        <div className="flex items-end gap-2">
          <textarea
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask your travel advisor…"
            className="flex-1 resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 max-h-32"
            style={{ minHeight: "38px" }}
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400 text-center">
          Press Enter to send · Shift+Enter for new line
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {/* Welcome — kept compact so it doesn't crowd the Wanderlog panel
            below it once an itinerary exists. */}
        {!hasMessages && (
          <div className="flex flex-col gap-2 pb-2 text-center">
            <p className="text-xs text-slate-500">
              Ask me anything about your trip, or try:
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {STARTER_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => sendMessage(p)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] text-slate-600 text-left hover:bg-slate-100 hover:border-slate-300 transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Message list */}
        {chatMessages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2 animate-fade-up",
              msg.role === "user" ? "flex-row-reverse" : "flex-row"
            )}
          >
            {/* Avatar */}
            <div
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-0.5",
                msg.role === "user"
                  ? "bg-slate-200 text-slate-600"
                  : "bg-brand-100 text-brand-600"
              )}
            >
              {msg.role === "user"
                ? <User size={11} />
                : <Sparkles size={11} />
              }
            </div>

            {/* Bubble */}
            <div className="flex max-w-[85%] flex-col gap-1.5">
              <div
                className={cn(
                  "rounded-xl px-3 py-2 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-brand-600 text-white rounded-tr-sm"
                    : "bg-slate-100 text-slate-700 rounded-tl-sm"
                )}
              >
                {msg.role === "assistant"
                  ? <div className="prose-chat" dangerouslySetInnerHTML={{ __html: markdownToHtml(msg.content) }} />
                  : msg.content
                }
              </div>
              {msg.preferenceUpdateSummary && (
                <div className="flex items-center gap-1.5 rounded-lg border border-sage-200 bg-sage-50 px-2.5 py-1.5 text-[11px] font-medium text-sage-700">
                  <CheckCircle2 size={12} className="shrink-0" />
                  {msg.preferenceUpdateSummary}
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {loading && (
          <div className="flex gap-2 animate-fade-up">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-600 mt-0.5">
              <Sparkles size={11} />
            </div>
            <div className="flex items-center gap-1 rounded-xl rounded-tl-sm bg-slate-100 px-3 py-2.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

    </div>
  );
}

// Minimal markdown → HTML converter for chat responses
function markdownToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code>$1</code>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>[^\n]+<\/li>)(\n<li>[^\n]+<\/li>)*/g, (match) => `<ul>${match}</ul>`)
    .replace(/\n\n/g, "</p><p>")
    .replace(/^(?!<[a-z])(.+)$/gm, "<p>$1</p>")
    .replace(/<p><\/p>/g, "");
}
