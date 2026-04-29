"use client";

import { useTripStore } from "@/lib/store/tripStore";
import { ProgressBar } from "@/components/planning/ProgressBar";
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

export function PlanningFlow() {
  const { trip, sidebarOpen, setSidebarOpen } = useTripStore();
  const StepComponent = STEP_COMPONENTS[trip.currentStep];

  return (
    <div className="flex h-full gap-0">
      {/* ── Left sidebar: progress ── */}
      <aside className="hidden lg:flex w-64 xl:w-72 shrink-0 flex-col border-r border-slate-200 bg-slate-50 p-5">
        <ProgressBar />
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
          <StepComponent />
        </div>
      </main>

      {/* ── Chat panel (slide-in on mobile, fixed column on xl+) ── */}
      <div
        className={`
          fixed inset-y-0 right-0 z-40 w-80 transform bg-white shadow-xl border-l border-slate-200
          transition-transform duration-300 ease-in-out lg:relative lg:inset-auto lg:z-auto
          lg:w-80 xl:w-96 lg:shadow-none lg:flex lg:flex-col
          ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        `}
      >
        {/* Mobile close button */}
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3 lg:hidden">
          <p className="font-semibold text-slate-700 text-sm">AI Travel Advisor</p>
          <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(false)}>
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">
          <ChatPanel />
        </div>
      </div>

      {/* Mobile chat toggle */}
      <button
        type="button"
        onClick={() => setSidebarOpen(true)}
        className="fixed bottom-6 right-6 z-30 flex h-12 w-12 items-center justify-center rounded-full bg-brand-600 text-white shadow-lg hover:bg-brand-700 transition-colors lg:hidden"
      >
        <MessageSquare size={20} />
      </button>
    </div>
  );
}
