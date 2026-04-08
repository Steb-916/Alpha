"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassButton } from "@/components/ui/GlassButton";
import { Badge } from "@/components/ui/Badge";
import { SignalCard } from "@/components/terminal/SignalCard";
import { PerformanceMetricsGrid } from "@/components/analyst/PerformanceMetrics";
import { CumulativePnlChart, MonthlyReturnsChart } from "@/components/analyst/PerformanceCharts";
import { ReviewsSection, generateMockReviews } from "@/components/analyst/ReviewsSection";
import { calculatePerformance, generateMockSignals } from "@/lib/performanceCalc";
import { getSignalStatusLabel } from "@/lib/signals";
import type { Signal } from "@/lib/signals";
// Phase 4: analytics widgets
import Link from "next/link";
import { DrawdownChart } from "@/components/analytics/DrawdownChart";
import { RollingWindowCards } from "@/components/analytics/RollingWindowCards";
import { BreakdownTable } from "@/components/analytics/BreakdownTable";
import { calculateDrawdown } from "@/lib/analytics/drawdown";
// Phase 6: follow button
import { FollowButton } from "@/components/social/FollowButton";

// Mock analysts for demo (will be replaced by API)
const MOCK_ANALYSTS: Record<
  string,
  {
    displayName: string;
    tagline: string;
    bio: string;
    avatarInitial: string;
    primaryAssets: string[];
    tradingStyle: string;
    experienceYears: number;
    subscriberCount: number;
    price: number;
  }
> = {
  "crypto-rex": {
    displayName: "CryptoRex",
    tagline: "Derivatives specialist. Liquidation hunter.",
    bio: "Full-time crypto derivatives trader since 2019. Focused on BTC/ETH perpetuals with a systematic approach to identifying liquidation cascades and funding rate dislocations.",
    avatarInitial: "C",
    primaryAssets: ["BTC", "ETH"],
    tradingStyle: "Swing",
    experienceYears: 5,
    subscriberCount: 342,
    price: 299,
  },
  "sol-whale": {
    displayName: "SolWhale",
    tagline: "Solana ecosystem alpha. On-chain detective.",
    bio: "Deep in Solana DeFi and NFTs since day one. Tracking whale wallets, protocol emissions, and governance plays for edge.",
    avatarInitial: "S",
    primaryAssets: ["SOL", "JTO", "JUP"],
    tradingStyle: "Position",
    experienceYears: 3,
    subscriberCount: 189,
    price: 149,
  },
  "degen-sensei": {
    displayName: "DegenSensei",
    tagline: "High-conviction altcoin calls. DYOR.",
    bio: "Former TradFi quant turned crypto degen. Combining statistical models with on-chain analytics for asymmetric bets on mid-caps.",
    avatarInitial: "D",
    primaryAssets: ["BTC", "ETH", "SOL", "DOGE"],
    tradingStyle: "Scalp / Swing",
    experienceYears: 7,
    subscriberCount: 891,
    price: 499,
  },
};

export default function AnalystProfilePage() {
  const params = useParams();
  const slug = params.slug as string;
  const analyst = MOCK_ANALYSTS[slug];

  // Generate mock signals and compute performance
  const { signals, metrics, drawdown } = useMemo(() => {
    if (!analyst) return { signals: [] as Signal[], metrics: null, drawdown: null };
    const sigs = generateMockSignals(slug);
    const perf = calculatePerformance(sigs);
    // Phase 4: drawdown computed locally on mock data so the chart works
    // even on demo analyst pages that aren't backed by the DB.
    const dd = calculateDrawdown(
      sigs.map((s) => ({
        resultPnlPercent: s.resultPnlPercent,
        resolvedAt: s.resolvedAt,
      })),
    );
    return { signals: sigs, metrics: perf, drawdown: dd };
  }, [slug, analyst]);

  if (!analyst) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--bg-primary)" }}
      >
        <GlassCard>
          <div className="text-center py-12 px-8">
            <div className="text-4xl mb-4">🔍</div>
            <h2
              className="text-xl font-bold font-display mb-2"
              style={{ color: "var(--text-primary)" }}
            >
              Analyst Not Found
            </h2>
            <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
              No analyst with slug &quot;{slug}&quot; exists.
            </p>
            <GlassButton
              variant="ghost"
              size="md"
              className="mt-4"
              onClick={() => (window.location.href = "/terminal")}
            >
              ← Back to Terminal
            </GlassButton>
          </div>
        </GlassCard>
      </div>
    );
  }

  const activeSignals = signals.filter((s) => s.status === "active");
  const recentResolved = signals
    .filter((s) => s.status !== "active")
    .slice(0, 20);

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg-primary)" }}
    >
      {/* Top nav back button */}
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center gap-3"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <button
          onClick={() => window.history.back()}
          className="text-sm font-body cursor-pointer"
          style={{ color: "var(--text-muted)" }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
        >
          ← Back
        </button>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          /analyst/{slug}
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
        {/* ===== PROFILE HEADER ===== */}
        <GlassCard glow="green">
          <div className="flex flex-col sm:flex-row gap-5">
            {/* Avatar */}
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold font-display shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,170,0.3), rgba(0,212,170,0.1))",
                border: "2px solid rgba(0, 212, 170, 0.4)",
                color: "var(--accent-green)",
              }}
            >
              {analyst.avatarInitial}
            </div>

            {/* Info */}
            <div className="flex-1">
              <div className="flex items-start justify-between">
                <div>
                  <h1
                    className="text-2xl font-bold font-display"
                    style={{ color: "var(--text-primary)" }}
                  >
                    {analyst.displayName}
                  </h1>
                  <p className="text-sm font-body mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    {analyst.tagline}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* Phase 6 follow button — uses slug as analystId for demo
                      mock pages; on real DB-backed analyst pages the slug
                      resolves to the correct user ID via the API. */}
                  <FollowButton analystId={slug} />
                  <GlassButton variant="primary" size="md" onClick={() => {}}>
                    Subscribe — ${analyst.price}/mo
                  </GlassButton>
                </div>
              </div>

              <p className="text-xs font-body mt-3 leading-relaxed" style={{ color: "var(--text-muted)" }}>
                {analyst.bio}
              </p>

              {/* Badges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {analyst.primaryAssets.map((a) => (
                  <Badge key={a} variant="blue">
                    {a}
                  </Badge>
                ))}
                <Badge variant="gray">{analyst.tradingStyle}</Badge>
                <Badge variant="gray">{analyst.experienceYears}y exp</Badge>
              </div>

              {/* Stats row */}
              <div className="flex gap-6 mt-3">
                <div>
                  <span className="text-[10px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
                    Subscribers
                  </span>
                  <span className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                    {analyst.subscriberCount.toLocaleString()}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
                    Signals
                  </span>
                  <span className="text-sm font-mono font-bold" style={{ color: "var(--text-primary)" }}>
                    {metrics?.totalSignals || 0}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
                    Total P&L
                  </span>
                  <span
                    className="text-sm font-mono font-bold"
                    style={{
                      color:
                        metrics?.totalPnlPercent && metrics.totalPnlPercent >= 0
                          ? "#10B981"
                          : "#EF4444",
                    }}
                  >
                    {metrics?.totalPnlPercent !== null && metrics?.totalPnlPercent !== undefined
                      ? `${metrics.totalPnlPercent >= 0 ? "+" : ""}${metrics.totalPnlPercent}%`
                      : "—"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>

        {/* ===== PHASE 4: ROLLING WINDOWS ===== */}
        <RollingWindowCards slug={slug} />

        {/* ===== PERFORMANCE METRICS ===== */}
        {metrics && (
          <GlassCard>
            <div className="flex items-center justify-between mb-3">
              <h2
                className="text-sm font-bold font-display"
                style={{ color: "var(--text-primary)" }}
              >
                Performance
              </h2>
              <Link
                href={`/analyst/${slug}/journal`}
                className="text-[10px] font-body cursor-pointer"
                style={{ color: "var(--accent-green)" }}
              >
                View trade journal →
              </Link>
            </div>
            <PerformanceMetricsGrid metrics={metrics} />
          </GlassCard>
        )}

        {/* ===== CHARTS ===== */}
        {metrics && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CumulativePnlChart data={metrics.cumulativePnl} />
            <MonthlyReturnsChart data={metrics.monthlyReturns} />
          </div>
        )}

        {/* ===== PHASE 4: DRAWDOWN ===== */}
        {drawdown && drawdown.drawdownSeries.length > 0 && (
          <DrawdownChart
            data={drawdown.drawdownSeries}
            maxDrawdownPct={drawdown.maxDrawdownPct}
          />
        )}

        {/* ===== PHASE 4: BREAKDOWN ===== */}
        <BreakdownTable slug={slug} />

        {/* ===== ACTIVE SIGNALS ===== */}
        {activeSignals.length > 0 && (
          <GlassCard>
            <h2
              className="text-sm font-bold font-display mb-3"
              style={{ color: "var(--text-primary)" }}
            >
              Active Signals ({activeSignals.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {activeSignals.map((sig) => (
                <SignalCard key={sig.id} signal={sig} showTakeSignal />
              ))}
            </div>
          </GlassCard>
        )}

        {/* ===== RECENT SIGNALS FEED ===== */}
        <GlassCard>
          <h2
            className="text-sm font-bold font-display mb-3"
            style={{ color: "var(--text-primary)" }}
          >
            Recent Signals
          </h2>
          {recentResolved.length === 0 ? (
            <p className="text-xs font-body py-4 text-center" style={{ color: "var(--text-muted)" }}>
              No resolved signals yet.
            </p>
          ) : (
            <div className="space-y-2">
              {recentResolved.map((sig) => (
                <SignalCard key={sig.id} signal={sig} compact showTakeSignal />
              ))}
            </div>
          )}
        </GlassCard>

        {/* ===== REVIEWS ===== */}
        <GlassCard>
          <ReviewsSection
            reviews={generateMockReviews(slug)}
            analystName={analyst.displayName}
          />
        </GlassCard>
      </div>
    </div>
  );
}
