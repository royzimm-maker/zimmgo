"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTripStore } from "@/lib/store/tripStore";
import { ProgressBar } from "@/components/planning/ProgressBar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { DestinationStep }    from "@/components/planning/steps/DestinationStep";
import { ActivitiesStep }     from "@/components/planning/steps/ActivitiesStep";
import { VibeStep }           from "@/components/planning/steps/VibeStep";
import { DatesStep }          from "@/components/planning/steps/DatesStep";
import { BudgetStep }         from "@/components/planning/steps/BudgetStep";
import { LodgingStep }        from "@/components/planning/steps/LodgingStep";
import { AirlinesStep }       from "@/components/planning/steps/AirlinesStep";
import { TransportationStep } from "@/components/planning/steps/TransportationStep";
import { ItineraryStep }      from "@/components/planning/steps/ItineraryStep";
import { RefineStep }         from "@/components/planning/steps/RefineStep";
import { ChatPanel }          from "@/components/chat/ChatPanel";
import { WanderlogPanel }     from "@/components/planning/WanderlogPanel";
import { Button }             from "@/components/ui/Button";
import { MessageSquare, X }   from "lucide-react";
import type { StepId }        from "@/types/trip";

const STEP_COMPONENTS: Record<StepId, React.ComponentType> = {
  destination:    DestinationStep,
  activities:     ActivitiesStep,
  vibe:           VibeStep,
  dates:          DatesStep,
  budget:         BudgetStep,
  lodging:        LodgingStep,
  airlines:       AirlinesStep,
  transportation: TransportationStep,
  itinerary:      ItineraryStep,
  refine:         RefineStep,
};

const WANDERLOG_HEIGHT_KEY = "zimmgo-wanderlog-panel-height";
const DEFAULT_WANDERLOG_HEIGHT = 288; // px — matches the old fixed h-72
const COLLAPSED_WANDERLOG_HEIGHT = 72; // px — just the header bar
const MIN_PANEL_HEIGHT = 120; // px — leaves both panels usably tall

export function PlanningFlow() {
  const { trip, sidebarOpen, setSidebarOpen } = useTripStore();
  const StepComponent = STEP_COMPONENTS[trip.currentStep];
  const latestItinerary = trip.itineraries[trip.itineraries.length - 1] ?? null;

  // Lets the user drag the divider between the chat and Wanderlog panels —
  // the fixed h-72 Wanderlog panel was squeezing the chat window with no
  // way to reclaim that space. Persisted across sessions since this is a
  // one-time layout preference, not per-trip state.
  //
  // Starts collapsed to just its header: the moment generation finishes,
  // Wanderlog is empty and ZiGy's chat is what the user actually wants
  // room for. It expands on its own once something's actually saved there,
  // unless the user has already set their own height by dragging.
  const [wanderlogHeight, setWanderlogHeight] = useState(COLLAPSED_WANDERLOG_HEIGHT);
  const [userResizedWanderlog, setUserResizedWanderlog] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);

  useEffect(() => {
    const saved = Number(localStorage.getItem(WANDERLOG_HEIGHT_KEY));
    if (saved && Number.isFinite(saved)) {
      setWanderlogHeight(saved);
      setUserResizedWanderlog(true);
    }
  }, []);

  const wanderlogItemCount = latestItinerary?.wanderlog?.length ?? 0;
  useEffect(() => {
    if (!userResizedWanderlog && wanderlogItemCount > 0) {
      setWanderlogHeight(DEFAULT_WANDERLOG_HEIGHT);
    }
  }, [wanderlogItemCount, userResizedWanderlog]);

  const handleDragStart = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    draggingRef.current = true;
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const handleDragMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current || !splitContainerRef.current) return;
    const rect = splitContainerRef.current.getBoundingClientRect();
    const next = rect.bottom - e.clientY;
    const clamped = Math.min(Math.max(next, MIN_PANEL_HEIGHT), rect.height - MIN_PANEL_HEIGHT);
    setWanderlogHeight(clamped);
  }, []);

  const handleDragEnd = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingRef.current) return;
    draggingRef.current = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    setUserResizedWanderlog(true);
    setWanderlogHeight((h) => {
      localStorage.setItem(WANDERLOG_HEIGHT_KEY, String(h));
      return h;
    });
  }, []);

  return (
    <div className="flex h-full gap-0 print:block print:h-auto">
      {/* ── Left sidebar: progress ── */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-5 print:hidden">
        <ProgressBar />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto print:overflow-visible">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6 print:max-w-none">
          <ErrorBoundary>
            <StepComponent />
          </ErrorBoundary>
        </div>
      </main>

      {/* ── Chat panel (slide-in on mobile, fixed column on xl+) ── */}
      <div
        className={`
          fixed inset-y-0 right-0 z-40 w-80 transform bg-white shadow-xl border-l border-slate-200
          transition-transform duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto
          lg:w-80 xl:w-96 lg:shadow-none lg:flex lg:flex-col print:hidden
          ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
          <p className="font-semibold text-slate-700 text-sm">ZiGy</p>
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </Button>
        </div>
        {latestItinerary ? (
          <div ref={splitContainerRef} className="flex flex-1 flex-col min-h-0">
            <div className="flex-1 min-h-0 overflow-hidden">
              <ChatPanel />
            </div>
            {/* Drag handle — resizes the split between chat and Wanderlog.
                The larger transparent hit area makes it easy to grab without
                needing pixel-perfect precision on the thin visible bar. */}
            <div
              onPointerDown={handleDragStart}
              onPointerMove={handleDragMove}
              onPointerUp={handleDragEnd}
              role="separator"
              aria-orientation="horizontal"
              aria-label="Resize chat and Wanderlog panels"
              className="relative shrink-0 cursor-row-resize touch-none border-t border-slate-200 bg-slate-50 hover:bg-brand-100 transition-colors"
            >
              <div className="absolute inset-x-0 -top-1.5 -bottom-1.5" />
              <div className="mx-auto my-0.5 h-1 w-8 rounded-full bg-slate-300" />
            </div>
            <div style={{ height: wanderlogHeight }} className="shrink-0 overflow-hidden">
              <WanderlogPanel itinerary={latestItinerary} />
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
        )}
      </div>

      {/* Mobile chat toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-colors lg:hidden print:hidden"
      >
        <MessageSquare size={20} />
      </button>
    </div>
  );
}
