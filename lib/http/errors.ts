import Anthropic from "@anthropic-ai/sdk";
import * as Sentry from "@sentry/nextjs";
import { waitUntil } from "@vercel/functions";
import { NextResponse } from "next/server";
import { AIDeadlineError } from "@/lib/ai/client";

// Unexpected server errors, turned into something safe to show a traveller.
// Raw exception messages never leave the server: Prisma errors name the
// database host, Anthropic errors carry API error bodies, and neither means
// anything to someone planning a trip. The full error is logged with a short
// reference that's also returned, so a reported message can be matched to
// its log line and its error report (Sentry, when configured).

export interface PublicError {
  status: number;
  message: string;
}

export function toPublicError(error: unknown): PublicError {
  if (error instanceof AIDeadlineError || error instanceof Anthropic.APIConnectionTimeoutError) {
    return { status: 504, message: "That took longer than expected — please try again." };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return { status: 503, message: "Couldn't reach ZimmGo's AI service — please try again in a moment." };
  }
  if (error instanceof Anthropic.RateLimitError || (error instanceof Anthropic.APIError && error.status === 529)) {
    return { status: 503, message: "ZimmGo is very busy right now — please try again in a minute." };
  }
  if (error instanceof Anthropic.APIError) {
    // Includes authentication/permission problems — an operator issue, logged
    // in full, not something the traveller can act on.
    return { status: 502, message: "ZimmGo's AI service had a problem — please try again." };
  }
  return { status: 500, message: "Something went wrong on our side — please try again." };
}

/** Logs `error` under `route` and returns a reference for matching reports to logs. */
export function logServerError(route: string, error: unknown): string {
  const ref = crypto.randomUUID().slice(0, 8);
  console.error(`[${route}] ref=${ref}`, error);
  if (Sentry.isEnabled()) {
    Sentry.captureException(error, { tags: { route, ref } });
    // A serverless function can be frozen right after it responds; keep it
    // alive until the report is sent.
    waitUntil(Sentry.flush(2000));
  }
  return ref;
}

/** The catch-all response for a route handler: logged in full, safe for the client. */
export function serverError(route: string, error: unknown): NextResponse {
  const ref = logServerError(route, error);
  const { status, message } = toPublicError(error);
  return NextResponse.json({ error: message, ref }, { status });
}
