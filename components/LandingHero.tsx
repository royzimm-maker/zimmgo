"use client";

import { ArrowRight, MapPin, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/branding/Logo";
import { useTripStore } from "@/lib/store/tripStore";
import { useRouter } from "next/navigation";

const DESTINATIONS = [
  { name: "Tokyo",      flag: "🇯🇵" },
  { name: "Patagonia",  flag: "🏔️" },
  { name: "Amalfi",     flag: "🇮🇹" },
  { name: "Iceland",    flag: "🇮🇸" },
  { name: "Kyoto",      flag: "🇯🇵" },
  { name: "Morocco",    flag: "🇲🇦" },
];

// Mirrors ORDERED_STEPS in types/trip.ts
const STEPS = [
  { icon: "📍", label: "Destination" },
  { icon: "📅", label: "Dates" },
  { icon: "✈️", label: "Flights" },
  { icon: "💰", label: "Budget" },
  { icon: "✨", label: "Vibe" },
  { icon: "🎯", label: "Activities" },
  { icon: "🏨", label: "Lodging" },
  { icon: "🚗", label: "Transport" },
  { icon: "🗺️", label: "Itinerary" },
];

export function LandingHero() {
  const { trip, resetTrip, startNewTrip: archiveAndStartNewTrip } = useTripStore();
  const router = useRouter();

  // A returning visitor who lands here (e.g. via a bookmark, not directly on
  // /plan) would otherwise have their saved trip silently wiped by a button
  // that just says "Start planning" — contradicts the "saved to this device"
  // promise shown elsewhere. Resume instead of resetting when there's real
  // progress; startNewTrip is still one click away below, and it archives
  // the current trip (so it's resumable later via the trip switcher) rather
  // than discarding it outright.
  const hasProgress = trip.completedSteps.length > 0 || trip.itineraries.length > 0;

  function startPlanning() {
    if (!hasProgress) resetTrip();
    router.push("/plan");
  }

  function startNewTrip() {
    archiveAndStartNewTrip();
    router.push("/plan");
  }

  return (
    <main className="min-h-screen bg-slate-50">
      {/* Beta banner — matches the plan page's beta banner exactly */}
      <div className="bg-amber-50 border-b border-amber-200 px-4 py-1.5 text-center">
        <p className="text-xs text-amber-700">
          <span className="inline-flex items-center gap-1 font-semibold mr-1">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Beta</span>
          </span>
          ZimmGo is an early prototype — recommendations are illustrative and not live booking data.
        </p>
      </div>

      {/* Nav */}
      <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
        <Logo size={34} />
        <button
          onClick={startPlanning}
          className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
        >
          Start planning →
        </button>
      </nav>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-6 pt-16 pb-24 text-center">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5">
          <Sparkles size={14} className="text-brand-600" />
          <span className="text-xs font-medium text-brand-700">AI-powered travel planning</span>
        </div>

        <h1 className="text-balance text-5xl font-bold text-slate-900 leading-tight sm:text-6xl">
          Plan trips like a{" "}
          <span className="bg-gradient-to-r from-brand-600 to-sage-600 bg-clip-text text-transparent">
            seasoned traveller
          </span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-500 leading-relaxed">
          ZimmGo acts as your personal AI travel advisor — guiding you step-by-step from
          destination to a complete day-by-day itinerary, with curated flights, hotels, and
          experiences matched to your taste and budget.
        </p>

        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Button size="lg" onClick={startPlanning} className="px-8">
            {hasProgress ? "Continue planning your trip" : "Start planning your trip"}
            <ArrowRight size={16} />
          </Button>
          {hasProgress ? (
            <button
              type="button"
              onClick={startNewTrip}
              className="text-sm text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
            >
              Start a new trip instead
            </button>
          ) : (
            <p className="text-sm text-slate-400">Free · No sign-up required</p>
          )}
        </div>

        {/* Progress steps preview */}
        <div className="mt-16 flex items-center justify-center gap-1 overflow-x-auto pb-2">
          {STEPS.map((step, idx) => (
            <div key={step.label} className="flex items-center">
              <div className="flex shrink-0 flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
                  {step.icon}
                </div>
                <span className="text-[10px] text-slate-400">{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="mx-1 h-px w-4 bg-slate-200 shrink-0" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          9 guided steps to help you plan everything you need for your next dream vacation
        </p>
      </div>

      {/* Popular destinations */}
      <div className="border-t border-slate-200 bg-white py-12 px-6">
        <p className="mb-6 text-center text-xs font-semibold uppercase tracking-widest text-slate-400">
          Popular destinations
        </p>
        <div className="mx-auto flex max-w-2xl flex-wrap justify-center gap-3">
          {DESTINATIONS.map((d) => (
            <button
              key={d.name}
              onClick={startPlanning}
              className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 transition-all hover:border-brand-400 hover:text-brand-700"
            >
              <span>{d.flag}</span>
              <MapPin size={12} className="text-slate-400" />
              {d.name}
            </button>
          ))}
        </div>
      </div>

      {/* Social proof */}
      <div className="border-t border-slate-200 py-10 px-6 text-center">
        <div className="flex items-center justify-center gap-1 mb-2">
          {[1,2,3,4,5].map((i) => (
            <Star key={i} size={14} className="fill-amber-400 text-amber-400" />
          ))}
        </div>
        <p className="text-slate-500 text-sm">
          &ldquo;Finally a trip planner that makes <em>actual recommendations</em> instead of endless lists.&rdquo;
        </p>
        <p className="mt-1 text-xs text-slate-400">— Early beta user</p>
      </div>

      {/* Powered by Claude */}
      <div className="border-t border-slate-200 py-5 px-6 text-center">
        <p className="text-xs text-slate-400 flex items-center justify-center gap-2">
          <Sparkles size={11} className="text-slate-400" />
          Powered by{" "}
          <a
            href="https://anthropic.com/claude"
            target="_blank"
            rel="noreferrer"
            className="text-slate-500 hover:text-slate-700 transition-colors font-medium"
          >
            Claude
          </a>
          {" "}· Built with the Anthropic API
        </p>
      </div>
    </main>
  );
}
