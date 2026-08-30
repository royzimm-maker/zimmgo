"use client";

import { useEffect } from "react";
import Image from "next/image";
import { ArrowLeft, ArrowRight, SkipForward } from "lucide-react";
import { cn, scrollStepToTop } from "@/lib/utils";
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
  // Hide the generic "Skip" button for steps where it would land on the same
  // next step as the primary Continue action — e.g. Itinerary's Continue is
  // itself "Personalize my plan", so a second "Skip" button next to it does
  // nothing Continue doesn't already do, it just adds a confusing duplicate.
  hideSkip?: boolean;
  // Decorative ZiGy illustration shown in the top-right corner of the step
  // header, next to the title — for steps with a themed avatar (Vibe,
  // Activities). Path to a static image under /public.
  headerImage?: string;
  // Optional compact content rendered under the subtitle, beside the header
  // image — lets a step reclaim the empty space a tall header image leaves
  // next to a short title/subtitle, instead of that space sitting blank
  // above the step's actual content. Keep it narrow-friendly (a dropdown, a
  // short line of text, a vertically-stacked control) since this column's
  // width varies with viewport and headerImage's own responsive size.
  headerExtra?: React.ReactNode;
}

export function StepShell({
  stepId,
  children,
  onContinue,
  continueLabel = "Continue",
  continueDisabled = false,
  continueLoading = false,
  subtitle,
  hideSkip = false,
  headerImage,
  headerExtra,
}: StepShellProps) {
  const { goToStep, completeStep, trip } = useTripStore();
  const meta  = STEP_META[stepId];

  // Scroll to top whenever a new step mounts.
  useEffect(() => {
    scrollStepToTop();
  }, []);
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
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-brand-500 mb-1">
            Step {idx + 1} of {ORDERED_STEPS.length}
          </p>
          <h2 className="text-2xl font-bold text-slate-900">{meta.label}</h2>
          <p className="mt-1 text-slate-500 text-sm">{subtitle ?? meta.description}</p>
          {headerExtra && <div className="mt-3">{headerExtra}</div>}
        </div>
        {headerImage && (
          <Image
            src={headerImage}
            alt=""
            width={200}
            height={200}
            // Sized off viewport breakpoints, not the column's actual
            // rendered width (Tailwind here has no container-query plugin
            // installed, so that's not available) — sm grows it for the
            // single-column layout below lg, then lg deliberately steps
            // back down, because PlanningFlow's fixed-width sidebar + chat
            // panel kick in at exactly that breakpoint and leave this
            // column narrower than it was a few px before, not wider. xl
            // grows it again once the wider chrome still leaves the column
            // comfortable.
            className="h-20 w-20 shrink-0 rounded-full select-none pointer-events-none sm:h-32 sm:w-32 lg:h-28 lg:w-28 xl:h-40 xl:w-40"
          />
        )}
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
          {nextId && !hideSkip && (
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
