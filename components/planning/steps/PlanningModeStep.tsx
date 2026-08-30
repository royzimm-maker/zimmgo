"use client";

import { useState } from "react";
import { StepShell } from "@/components/planning/StepShell";
import { ChooseModePrompt, type ModeChoice } from "@/components/planning/ChooseModePrompt";
import { useTripStore } from "@/lib/store/tripStore";

// Sits between Activities and Lodging — lets the traveller hand the rest of
// the trip (lodging, activities, restaurants, and day-by-day scheduling)
// entirely to ZiGy in one shot, instead of clicking "let ZiGy pick" on each
// screen in turn. Choosing "myself" changes nothing about the flow below;
// choosing ZiGy sets autoPlanEverything, which the Lodging step and the
// Itinerary step both read to skip their manual pickers.
export function PlanningModeStep() {
  const { trip, setAutoPlanEverything } = useTripStore();
  const [choice, setChoice] = useState<ModeChoice | null>(
    trip.preferences.autoPlanEverything ? "zigy" : trip.preferences.autoPlanEverything === false ? "manual" : null
  );

  function handleContinue() {
    setAutoPlanEverything(choice === "zigy");
  }

  return (
    <StepShell
      stepId="planningMode"
      onContinue={handleContinue}
      continueDisabled={!choice}
      subtitle="How much do you want to handle yourself from here?"
      headerImage="/zigy-vibe.png"
    >
      <ChooseModePrompt
        manualLabel="I'll go through it myself"
        manualDescription="Pick your lodging, activities, and restaurants step by step — you can still ask ZiGy to choose for you on any individual screen along the way."
        zigyLabel="Let ZiGy plan my whole trip"
        zigyLoadingLabel="Let ZiGy plan my whole trip"
        zigyDescription="Lodging, activities, restaurants, and the day-by-day schedule — all decided for you. You'll land straight on the finished plan, and can still adjust anything before you go."
        selected={choice}
        onSelect={setChoice}
        loading={false}
      />
    </StepShell>
  );
}
