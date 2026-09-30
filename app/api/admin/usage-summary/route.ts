import { NextRequest, NextResponse } from "next/server";
import { serverError } from "@/lib/http/errors";
import { prisma } from "@/lib/db";
import { estimateCostUsd } from "@/lib/ai/usageLog";
import { secretsMatch } from "@/lib/gateAuth";

// Aggregated view of app/api/**/route.ts's logged Anthropic usage (see
// lib/ai/usageLog.ts) — real measured token counts and an estimated dollar
// cost from them, broken down by route. No UI here, just JSON: hit it with
// `curl -H "x-admin-token: ..." .../api/admin/usage-summary?days=30`.
//
// Gated by a shared secret rather than real auth (there's no user/account
// system in this app at all) — set ADMIN_TOKEN in the environment to enable
// this route; it refuses every request until that's set, so it can't be
// left open by accident.

const DEFAULT_DAYS = 30;
const MAX_DAYS = 366; // a year back bounds the scan; a bad value falls back to 30

interface RouteTotals { calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number }
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export async function GET(request: NextRequest) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  }
  if (!(await secretsMatch(request.headers.get("x-admin-token") ?? "", configuredToken))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const requested = Number(request.nextUrl.searchParams.get("days") ?? DEFAULT_DAYS);
    const days = Number.isFinite(requested) && requested > 0 ? Math.min(requested, MAX_DAYS) : DEFAULT_DAYS;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Summed in the database, one row per route and model — cost is linear
    // in tokens, so pricing each group's totals is exact.
    const groups = await prisma.apiUsageEvent.groupBy({
      by: ["route", "model"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
    });

    const byRoute: Record<string, RouteTotals> = {};
    let totalCalls = 0;
    let totalCostUsd = 0;
    for (const g of groups) {
      const tokens = {
        inputTokens: g._sum.inputTokens ?? 0,
        outputTokens: g._sum.outputTokens ?? 0,
        cacheReadTokens: g._sum.cacheReadTokens ?? 0,
        cacheWriteTokens: g._sum.cacheWriteTokens ?? 0,
      };
      const cost = estimateCostUsd(g.model, tokens);
      const row = (byRoute[g.route] ??= { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 });
      row.calls += g._count._all;
      row.inputTokens += tokens.inputTokens;
      row.outputTokens += tokens.outputTokens;
      row.cacheReadTokens += tokens.cacheReadTokens;
      row.cacheWriteTokens += tokens.cacheWriteTokens;
      row.costUsd += cost;
      totalCalls += g._count._all;
      totalCostUsd += cost;
    }
    for (const row of Object.values(byRoute)) row.costUsd = round4(row.costUsd);

    return NextResponse.json({ windowDays: days, totalCalls, totalCostUsd: round4(totalCostUsd), byRoute });
  } catch (error: unknown) {
    return serverError("admin/usage-summary", error);
  }
}
