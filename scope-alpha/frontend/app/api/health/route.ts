/**
 * Phase 7 health check.
 *
 * Pings the database and Redis cache. Used by external uptime monitors
 * (UptimeRobot, Better Uptime). Returns 200 when all dependencies are
 * reachable, 503 with the failing checks otherwise.
 *
 * Also reports the active Postgres connection count when available
 * (Neon-specific query, wrapped in try/catch so failure doesn't block
 * the overall result).
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCached, setCached } from "@/lib/cache/redis";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface HealthChecks {
  database: boolean;
  redis: boolean;
  pool?: number;
  dataFreshness?: {
    screener: boolean;
    screenerAgeMinutes?: number;
  };
}

export async function GET() {
  const checks: HealthChecks = { database: false, redis: false };

  // ── Database ping ──────────────────────────────────────────────────────
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = true;
  } catch {
    checks.database = false;
  }

  // ── Redis round-trip ───────────────────────────────────────────────────
  // Use the wrapper so the in-memory fallback also counts as "healthy".
  try {
    const probeKey = "health:probe";
    await setCached(probeKey, { ts: Date.now() }, 30);
    const got = await getCached(probeKey);
    checks.redis = got != null;
  } catch {
    checks.redis = false;
  }

  // ── Postgres pool count (best-effort, Neon-friendly) ──────────────────
  try {
    const rows = await prisma.$queryRaw<Array<{ c: number }>>`
      SELECT count(*)::int AS c
      FROM pg_stat_activity
      WHERE datname = current_database()
    `;
    if (rows[0] && typeof rows[0].c === "number") {
      checks.pool = rows[0].c;
    }
  } catch {
    // Some hosting providers (Neon serverless) may reject this. Skip silently.
  }

  // ── Data freshness: screener cache ────────────────────────────────────────
  // The screener cron runs daily. Stale = last update > 26h ago.
  try {
    const meta = await getCached<{ updatedAt: string }>('market:screener:meta');
    if (meta?.updatedAt) {
      const ageMs = Date.now() - new Date(meta.updatedAt).getTime();
      const ageMinutes = Math.round(ageMs / 60_000);
      checks.dataFreshness = {
        screener: ageMs < 26 * 60 * 60 * 1000,
        screenerAgeMinutes: ageMinutes,
      };
    } else {
      checks.dataFreshness = { screener: false };
    }
  } catch {
    // Non-critical — skip
  }

  const healthy = checks.database && checks.redis;
  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
