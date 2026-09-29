"use client";

import { ErrorRecovery } from "@/components/ErrorRecovery";
import "./globals.css";

// Last line of defence: catches errors in the root layout itself (e.g. the
// trip sync provider), which app/error.tsx can't. It replaces the root
// layout, so it renders its own <html> and <body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <ErrorRecovery error={error} reset={reset} />
      </body>
    </html>
  );
}
