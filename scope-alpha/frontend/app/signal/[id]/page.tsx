/**
 * Public signal detail page.
 *
 * Server component so generateMetadata can build OG tags at request time
 * for rich Twitter/X / LinkedIn previews. The OG metadata intentionally
 * does NOT include prices — only asset, direction, and analyst name —
 * driving click-through to the platform.
 *
 * Rendered body shows:
 *   - Signal card with full or preview data (depending on viewer access)
 *   - Analyst mini-profile
 *   - Subscribe CTA when not subscribed
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { GlassCard } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/Badge";
import { SignalDisclaimer } from "@/components/legal/SignalDisclaimer";

interface PageProps {
  params: { id: string };
}

async function fetchSignalForOg(id: string) {
  // We query directly via Prisma here (rather than the API route) because
  // generateMetadata runs server-side and we want the cheapest possible
  // path. Prices are intentionally excluded.
  return prisma.signal.findUnique({
    where: { id },
    select: {
      id: true,
      assetSymbol: true,
      direction: true,
      conviction: true,
      status: true,
      screenshotUrl: true,
      analyst: {
        select: {
          slug: true,
          displayName: true,
          name: true,
        },
      },
    },
  });
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const signal = await fetchSignalForOg(params.id);
  if (!signal) {
    return { title: "Signal not found · Scope Alpha" };
  }

  const direction = signal.direction.toUpperCase();
  const emoji = signal.direction === "long" ? "🟢" : "🔴";
  const analystName =
    signal.analyst.displayName || signal.analyst.name || "Analyst";

  const title = `${emoji} ${signal.assetSymbol} ${direction} — ${analystName} on Scope Alpha`;
  const description = `${analystName} published a ${signal.conviction} conviction ${direction} signal on ${signal.assetSymbol}. View on Scope Alpha.`;
  const baseUrl =
    process.env.NEXT_PUBLIC_BASE_URL || "https://scopealpha.com";
  const pageUrl = `${baseUrl}/signal/${signal.id}`;

  return {
    title,
    description,
    openGraph: {
      title: `${signal.assetSymbol} ${direction} Signal`,
      description: `${signal.conviction} conviction ${direction} on ${signal.assetSymbol} by ${analystName}`,
      type: "article",
      url: pageUrl,
      images: signal.screenshotUrl ? [{ url: signal.screenshotUrl }] : [],
    },
    twitter: {
      card: signal.screenshotUrl ? "summary_large_image" : "summary",
      title: `${emoji} ${signal.assetSymbol} ${direction} — ${analystName}`,
      description: `${signal.conviction} conviction · View full signal on Scope Alpha`,
    },
  };
}

export default async function SignalDetailPage({ params }: PageProps) {
  const signal = await prisma.signal.findUnique({
    where: { id: params.id },
    include: {
      targets: { orderBy: { order: "asc" } },
      analyst: {
        select: {
          slug: true,
          displayName: true,
          name: true,
          email: true,
          analystPerformance: {
            select: {
              winRate: true,
              totalSignals: true,
              subscriberCount: true,
            },
          },
          subscriptionTiers: {
            where: { isActive: true },
            orderBy: { priceUsd: "asc" },
            take: 1,
          },
        },
      },
    },
  });

  if (!signal || signal.status === "draft") {
    notFound();
  }

  const analystName =
    signal.analyst.displayName || signal.analyst.name || "Analyst";
  const avatarInitial = (analystName[0] ?? "?").toUpperCase();
  const cheapestTier = signal.analyst.subscriptionTiers[0] ?? null;
  const isLong = signal.direction === "long";

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "var(--bg-primary)" }}
    >
      <div className="max-w-2xl mx-auto pt-8 space-y-4">
        <Link
          href="/"
          className="text-xs font-body cursor-pointer no-underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Scope Alpha
        </Link>

        <GlassCard glow="green">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold font-display"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(0,212,170,0.3), rgba(0,212,170,0.1))",
                  border: "2px solid rgba(0, 212, 170, 0.4)",
                  color: "var(--accent-green)",
                }}
              >
                {avatarInitial}
              </div>
              <div>
                <Link
                  href={`/analyst/${signal.analyst.slug}`}
                  className="text-base font-bold font-display no-underline"
                  style={{ color: "var(--text-primary)" }}
                >
                  {analystName}
                </Link>
                <div
                  className="text-[10px] font-mono"
                  style={{ color: "var(--text-muted)" }}
                >
                  {signal.analyst.analystPerformance?.winRate
                    ? `${Number(signal.analyst.analystPerformance.winRate).toFixed(0)}% win rate`
                    : "—"}
                  {" · "}
                  {signal.analyst.analystPerformance?.subscriberCount ?? 0} subscribers
                </div>
              </div>
            </div>
            {cheapestTier && (
              <Link
                href={`/analyst/${signal.analyst.slug}`}
                className="px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
                style={{ background: "var(--accent-green)", color: "#fff" }}
              >
                Subscribe ${cheapestTier.priceUsd / 100}/mo
              </Link>
            )}
          </div>

          {/* Signal core */}
          <div
            className="p-4 rounded-[var(--radius-md)] mb-3"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <div className="flex items-center gap-3 mb-2">
              <span
                className="text-lg font-bold"
                style={{ color: isLong ? "#10B981" : "#EF4444" }}
              >
                {isLong ? "▲ LONG" : "▼ SHORT"}
              </span>
              <span
                className="text-lg font-mono font-bold"
                style={{ color: "var(--text-primary)" }}
              >
                {signal.assetSymbol}
              </span>
              <Badge variant={isLong ? "green" : "red"}>{signal.timeframe}</Badge>
              <Badge variant="purple">{signal.conviction.toUpperCase()}</Badge>
              <Badge variant="gray">{signal.status}</Badge>
            </div>

            {/* Subscription gate notice */}
            <div
              className="text-xs font-body p-3 rounded-[var(--radius-sm)] text-center"
              style={{
                background: "rgba(0, 212, 170, 0.06)",
                border: "1px dashed rgba(0, 212, 170, 0.3)",
                color: "var(--text-secondary)",
              }}
            >
              🔒 Entry, target, and stop loss are visible to{" "}
              <Link
                href={`/analyst/${signal.analyst.slug}`}
                className="font-bold no-underline"
                style={{ color: "var(--accent-green)" }}
              >
                {analystName}&apos;s subscribers
              </Link>
              {cheapestTier && ` (from $${cheapestTier.priceUsd / 100}/mo)`}
            </div>

            {signal.screenshotUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={signal.screenshotUrl}
                alt="Signal chart"
                className="mt-3 rounded-[var(--radius-sm)]"
                style={{
                  maxWidth: "100%",
                  border: "1px solid var(--glass-border)",
                }}
              />
            )}
          </div>

          {/* CTA */}
          <Link
            href={`/analyst/${signal.analyst.slug}`}
            className="block text-center px-4 py-3 text-sm font-bold rounded-[var(--radius-md)] no-underline"
            style={{ background: "var(--accent-green)", color: "#fff" }}
          >
            View {analystName}&apos;s profile →
          </Link>

          {/* Phase 7: not-financial-advice disclaimer */}
          <SignalDisclaimer variant="block" />
        </GlassCard>
      </div>
    </div>
  );
}
