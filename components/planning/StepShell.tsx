"use client";

import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/Button";
import { useTripStore } from "@/lib/store/tripStore";
import { ORDERED_STEPS, STEP_META, type StepId } from "@/types/trip";

interface StepShellProps {
  stepId: StepId;
  children: React.ReactNode;
  // Called before navigation; can be async. Return false to cancel navigation
  // (e.g. when validation fails).
  onContinue?: () => void | boolean | Promise<void | boolean>;
  continueLabel?: string;
  continueDisabled?: boolean;
  continueLoading?: boolean;
  subtitle?: string;
}

export function StepShell({
  stepId,
  children,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  continueLoading = false,
  subtitle,
}: StepShellProps) {
  const { goToStep, completeStep, trip } = useTripStore();
  const meta  = STEP_META[stepId];
  const idx   = ORDERED_STEPS.indexOf(stepId);
  const prevId = idx > 0 ? ORDERED_STEPS[idx - 1] : null;
  const nextId = idx < ORDERED_STEPS.length - 1 ? ORDERED_STEPS[idx + 1] : null;

  async function handleContinue() {
    if (onContinue) {
      const result = await onContinue();
      if (result === false) return; // validation failed — stay on this step
    }
    completeStep(stepId);
    if (nextId) goToStep(nextId);
  }

  function handleSkip() {
    if (nextId) goToStep(nextId);
  }

  return (
    <div className="flex flex-col gap-6 animate-fade-up">
      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-1">
          Step {idx + 1} of {ORDERED_STEPS.length}
        </p>
        <h2 className="text-2xl font-bold text-slate-900">{meta.label}</h2>
        <p className="mt-1 text-slate-500 text-sm">{subtitle ?? meta.description}</p>
      </div>

      {/* Content */}
      <div>{children}</div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div>
          {prevId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goToStep(prevId)}
              className="text-slate-500"
            >
              <ArrowLeft size={14} />
              Back
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {nextId && (
            <Button variant="ghost" size="sm" onClick={handleSkip} className="text-slate-400">
              Skip
              <SkipForward size={14} />
            </Button>
          )}
          <Button
            variant="primary"
            onClick={handleContinue}
            disabled={continueDisabled}
            loading={continueLoading}
          >
            {continueLabel}
            {!continueLoading && <ArrowRight size={14} />}
          </Button>
        </div>
      </div>
    </div>
  );
}
