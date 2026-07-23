"use client";

import { useRouter } from "next/navigation";
import { useTripStore } from "@/lib/store/tripStore";

export function StartOverButton() {
  const { resetTrip } = useTripStore();
  const router = useRouter();

  function handleClick() {
    resetTrip();          // clears trip + chat history
    router.push("/");
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="text-xs text-slate-500 hover:text-slate-700 transition-colors"
    >
      Start new trip
    </button>
  );
}
