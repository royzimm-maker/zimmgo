"use client";

import { ErrorRecovery } from "@/components/ErrorRecovery";

// Catches rendering errors in any page, so a crash shows a way out instead
// of a blank screen. See components/ErrorRecovery.tsx.
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorRecovery error={error} reset={reset} />;
}
