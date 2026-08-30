import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { estimateCostUsd } from "@/lib/ai/usageLog";

// Aggregated view of app/api/**/route.ts's logged Anthropic usage (see
// lib/ai/usageLog.ts) — real measured token counts and an estimated dollar
// cost from them, broken down by route. No UI here, just JSON: hit it with
// `curl -H "x-admin-token: ..." .../api/admin/usage-summary?days=30`.
//
// Gated by a shared secret rather than real auth (there's no user/account
// system in this app at all) — set ADMIN_TOKEN in the environment to enable
// this route; it refuses every request until that's set, so it can't be
// left open by accident.
export async function GET(request: NextRequest) {
  const configuredToken = process.env.ADMIN_TOKEN;
  if (!configuredToken) {
    return NextResponse.json({ error: "ADMIN_TOKEN is not configured on the server" }, { status: 503 });
  }
  if (request.headers.get("x-admin-token") !== configuredToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const days = Number(request.nextUrl.searchParams.get("days") ?? 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const events = await prisma.apiUsageEvent.findMany({
      where: { createdAt: { gte: since } },
      select: { route: true, model: true, inputTokens: true, outputTokens: true, cacheReadTokens: true, cacheWriteTokens: true },
    });

    const byRoute = new Map<string, { calls: number; inputTokens: number; outputTokens: number; cacheReadTokens: number; cacheWriteTokens: number; costUsd: number }>();
    let totalCostUsd = 0;
    let totalCalls = 0;

    for (const e of events) {
      const cost = estimateCostUsd(e.model, e);
      totalCostUsd += cost;
      totalCalls += 1;

      const row = byRoute.get(e.route) ?? { calls: 0, inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, costUsd: 0 };
      row.calls += 1;
      row.inputTokens += e.inputTokens;
      row.outputTokens += e.outputTokens;
      row.cacheReadTokens += e.cacheReadTokens;
      row.cacheWriteTokens += e.cacheWriteTokens;
      row.costUsd += cost;
      byRoute.set(e.route, row);
    }

    return NextResponse.json({
      windowDays: days,
      totalCalls,
      totalCostUsd: Math.round(totalCostUsd * 10000) / 10000,
      byRoute: Object.fromEntries(
        Array.from(byRoute.entries()).map(([route, r]) => [route, { ...r, costUsd: Math.round(r.costUsd * 10000) / 10000 }])
      ),
    });
  } catch (error: unknown) {
    console.error("[admin/usage-summary]", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
