"use client";

/**
 * Subscriber portfolio dashboard.
 *
 * Sections (top to bottom):
 *   1. Summary cards (closed P&L + unrealized total + counts)
 *   2. Equity curve chart (closed positions only)
 *   3. Per-analyst breakdown
 *   4. Active positions table (with live unrealized P&L)
 *   5. Closed positions table
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/ui/GlassCard";
import { PortfolioSummaryCards } from "@/components/portfolio/PortfolioSummaryCards";
import { PortfolioEquityCurve } from "@/components/portfolio/PortfolioEquityCurve";
import { AnalystBreakdownRow } from "@/components/portfolio/AnalystBreakdownRow";
import {
  ActivePositionsTable,
  type PortfolioRow,
} from "@/components/portfolio/ActivePositionsTable";
import { ClosedPositionsTable } from "@/components/portfolio/ClosedPositionsTable";
import type { PortfolioSummary } from "@/lib/portfolio/summary";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

interface PortfolioResponse {
  positions: PortfolioRow[];
  summary: PortfolioSummary;
  nextCursor: string | null;
}

export default function PortfolioPage() {
  const { data: session } = useSession();
  const { data, error, mutate, isLoading } = useSWR<PortfolioResponse>(
    session?.user?.id ? "/api/portfolio?status=all&limit=100" : null,
    fetcher,
    { refreshInterval: 30_000 },
  );

  const [unrealizedMap, setUnrealizedMap] = useState<Record<string, number>>({});

  // Sum unrealized P&L for the summary cards.
  const unrealizedTotal = Object.values(unrealizedMap).reduce(
    (s, v) => s + v,
    0,
  );

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-md mx-auto pt-12">
          <GlassCard>
            <p
              className="text-sm font-body text-center"
              style={{ color: "var(--text-muted)" }}
            >
              Sign in to view your portfolio.
            </p>
            <div className="text-center mt-3">
              <Link
                href="/login"
                className="px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
                style={{ background: "var(--accent-green)", color: "#fff" }}
              >
                Sign in →
              </Link>
            </div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-md mx-auto pt-12">
          <GlassCard>
            <p className="text-sm font-body" style={{ color: "var(--accent-red)" }}>
              Failed to load portfolio.
            </p>
          </GlassCard>
        </div>
      </div>
    );
  }

  const positions = data?.positions ?? [];
  const summary = data?.summary;
  const active = positions.filter((p) => p.status === "active");
  const closed = positions.filter((p) => p.status === "closed");

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      {/* Top nav */}
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center gap-3"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <Link
          href="/marketplace"
          className="text-sm font-body cursor-pointer no-underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Marketplace
        </Link>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          /portfolio
        </span>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            My Portfolio
          </h1>
          <p
            className="text-sm font-body mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Track signals you&apos;ve taken with your own entry prices and personal P&L.
          </p>
        </div>

        {isLoading && !data && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          </GlassCard>
        )}

        {summary && positions.length === 0 && (
          <GlassCard>
            <div className="text-center py-8">
              <p
                className="text-sm font-body"
                style={{ color: "var(--text-muted)" }}
              >
                No tracked signals yet. Subscribe to an analyst and click &quot;Take Signal&quot; on any active signal to start tracking.
              </p>
              <Link
                href="/marketplace"
                className="inline-block mt-3 px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
                style={{ background: "var(--accent-green)", color: "#fff" }}
              >
                Browse marketplace →
              </Link>
            </div>
          </GlassCard>
        )}

        {summary && positions.length > 0 && (
          <>
            <PortfolioSummaryCards
              summary={summary}
              unrealizedTotal={unrealizedTotal}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <PortfolioEquityCurve summary={summary} />
              <AnalystBreakdownRow summary={summary} />
            </div>

            <ActivePositionsTable
              positions={active}
              onClosed={() => mutate()}
              onUnrealizedComputed={setUnrealizedMap}
            />

            <ClosedPositionsTable positions={closed} />
          </>
        )}
      </div>
    </div>
  );
}
