"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTripStore } from "@/lib/store/tripStore";
import { ORDERED_STEPS, STEP_META, type StepId } from "@/types/trip";

export function ProgressBar() {
  const { trip, progress, goToStep } = useTripStore();
  const { currentStep, completedSteps } = trip;

  return (
    <div className="flex flex-col gap-3">
      {/* Numeric progress */}
      <div className="flex items-center justify-between text-xs font-medium">
        <span className="text-slate-500 uppercase tracking-wide">Planning Progress</span>
        <span className="text-brand-600 tabular-nums">{progress}%</span>
      </div>

      {/* Bar */}
      <div className="h-1.5 w-full rounded-full bg-slate-200 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-brand-500 to-sage-500 transition-all duration-700 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Step list */}
      <ol className="mt-1 space-y-1">
        {ORDERED_STEPS.map((stepId, idx) => {
          const meta        = STEP_META[stepId];
          const isCompleted = completedSteps.includes(stepId);
          const isCurrent   = currentStep === stepId;
          const isPast      = ORDERED_STEPS.indexOf(currentStep) > idx;
          const isLocked    = !isCompleted && !isCurrent && !isPast;

          return (
            <li key={stepId}>
              <button
                type="button"
                disabled={isLocked}
                onClick={() => goToStep(stepId)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150",
                  isCurrent  && "bg-brand-50 text-brand-700 font-medium",
                  isCompleted && !isCurrent && "text-slate-600 hover:bg-slate-50",
                  isLocked   && "text-slate-400 cursor-not-allowed",
                  !isCurrent && !isLocked && "hover:bg-slate-50"
                )}
              >
                {/* Icon */}
                <span
                  className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    isCompleted && "bg-sage-500 text-white",
                    isCurrent && !isCompleted && "bg-brand-600 text-white",
                    isLocked && "bg-slate-200 text-slate-400",
                    !isCurrent && !isCompleted && !isLocked && "bg-slate-200 text-slate-600"
                  )}
                >
                  {isCompleted ? <Check size={12} strokeWidth={3} /> : idx + 1}
                </span>

                {/* Label */}
                <span className="flex-1 text-left truncate">{meta.label}</span>

                {meta.skippable && isLocked && (
                  <span className="text-[10px] text-slate-400 italic">optional</span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
