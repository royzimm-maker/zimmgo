"use client";

import { ArrowRight, Star, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/branding/Logo";
import { TripSwitcher } from "@/components/TripSwitcher";
import { useTripStore } from "@/lib/store/tripStore";
import { useRouter } from "next/navigation";

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
  const { trip, savedTrips, resetTrip, startNewTrip: archiveAndStartNewTrip } = useTripStore();
  const router = useRouter();

  // A returning visitor who lands here (e.g. via a bookmark, not directly on
  // /plan) would otherwise have their saved trip silently wiped by a button
  // that just says "Start planning" — contradicts the "saved to this device"
  // promise shown elsewhere. Resume instead of resetting when there's real
  // progress; startNewTrip is still one click away below, and it archives
  // the current trip (so it's resumable later via the trip switcher) rather
  // than discarding it outright.
  const hasProgress = trip.completedSteps.length > 0 || trip.itineraries.length > 0;
  // Landing here only ever surfaces the *active* trip — anyone with more than
  // one trip in progress needs a way to jump straight to an older one instead
  // of always resuming whichever was worked on most recently.
  const hasMultipleTrips = hasProgress && savedTrips.length > 0;

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
      {/* Nav — carries the beta disclosure as a compact badge instead of a separate strip */}
      <nav className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3">
        <Logo size={64} showTagline />
        <div className="flex items-center gap-3">
          {hasMultipleTrips && <TripSwitcher label="My Saved Trips" />}
          <span className="hidden items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs text-amber-700 sm:inline-flex">
            <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800">Beta</span>
            Early prototype — not live booking data
          </span>
        </div>
      </nav>
      <p className="border-b border-amber-100 bg-amber-50/60 px-4 py-1 text-center text-[11px] text-amber-700 sm:hidden">
        <span className="font-bold uppercase tracking-wide">Beta</span> · Early prototype, not live booking data
      </p>

      {/* Hero */}
      <div className="mx-auto max-w-4xl px-6 pt-8 pb-8 text-center">
        <h1 className="text-balance text-4xl font-bold text-slate-900 leading-tight sm:text-5xl">
          Plan trips like a{" "}
          <span className="bg-gradient-to-r from-brand-600 to-sage-600 bg-clip-text text-transparent">
            seasoned traveller
          </span>
        </h1>

        <p className="mx-auto mt-4 max-w-2xl text-lg text-slate-500 leading-relaxed">
          ZimmGo acts as your personal AI travel advisor — guiding you step-by-step from
          destination to a complete day-by-day itinerary, with curated flights, hotels, and
          experiences matched to your taste and budget.
        </p>

        {hasProgress ? (
          <div className="mt-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button size="lg" onClick={startPlanning} className="px-8">
              Pick up where you left off
              <ArrowRight size={16} />
            </Button>
            <Button size="lg" variant="outline" onClick={startNewTrip} className="px-8">
              Start a new trip
            </Button>
          </div>
        ) : (
          <div className="mt-6 flex flex-col items-center gap-4">
            <Button size="lg" onClick={startPlanning} className="px-8">
              Start planning your trip
              <ArrowRight size={16} />
            </Button>
            <p className="text-sm text-slate-400">Free · No sign-up required</p>
          </div>
        )}

        {/* Progress steps preview */}
        <div className="mt-8 flex flex-wrap items-start justify-center gap-x-1 gap-y-4">
          {STEPS.map((step, idx) => (
            <div key={step.label} className="flex items-center">
              <div className="flex w-14 shrink-0 flex-col items-center gap-1">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
                  {step.icon}
                </div>
                <span className="text-[10px] text-slate-400">{step.label}</span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className="mx-1 hidden h-px w-4 bg-slate-200 shrink-0 sm:block" />
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          9 guided steps to help you plan everything you need for your next dream vacation
        </p>
      </div>

      {/* Social proof */}
      <div className="border-t border-slate-200 py-5 px-6 text-center">
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
      <div className="border-t border-slate-200 py-3 px-6 text-center">
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
