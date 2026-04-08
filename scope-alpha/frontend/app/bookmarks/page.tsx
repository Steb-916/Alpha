"use client";

/**
 * Bookmarked signals page. Renders the user's bookmarked signals as a grid
 * of standard SignalCard components.
 */

import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { SignalCard } from "@/components/terminal/SignalCard";
import { GlassCard } from "@/components/ui/GlassCard";
import type { Signal } from "@/lib/signals";
import type { SerializedSignal } from "@/lib/signals/serializer";

interface BookmarkResponse {
  items: Array<{
    bookmarkedAt: string;
    signal: SerializedSignal;
  }>;
  nextCursor: string | null;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

// SerializedSignal → legacy Signal shape adapter (the SignalCard component
// reads the legacy Signal type from lib/signals.ts).
function toLegacySignal(s: SerializedSignal): Signal {
  return {
    id: s.id,
    analystId: s.analystId,
    assetSymbol: s.assetSymbol,
    direction: s.direction as "long" | "short",
    entryPrice: s.entryPrice,
    targetPrice: s.targetPrice,
    stopLossPrice: s.stopLossPrice,
    timeframe: s.timeframe,
    conviction: s.conviction as "low" | "medium" | "high",
    notes: s.notes,
    status: s.status as Signal["status"],
    publishedAt: s.publishedAt ?? new Date().toISOString(),
    resolvedAt: s.resolvedAt,
    resolvedPrice: s.resolvedPrice,
    resultPnlPercent: s.resultPnlPercent,
    createdAt: s.createdAt,
    targets: s.targets,
    templateId: s.templateId,
    screenshotUrl: s.screenshotUrl,
  };
}

export default function BookmarksPage() {
  const { data: session } = useSession();
  const { data, error, isLoading } = useSWR<BookmarkResponse>(
    session?.user?.id ? "/api/bookmarks?limit=50" : null,
    fetcher,
  );

  if (!session?.user?.id) {
    return (
      <div className="min-h-screen p-6" style={{ background: "var(--bg-primary)" }}>
        <div className="max-w-md mx-auto pt-12">
          <GlassCard>
            <p className="text-sm font-body text-center" style={{ color: "var(--text-muted)" }}>
              Sign in to view your bookmarks.
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

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
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
          /bookmarks
        </span>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Bookmarked Signals
          </h1>
          <p
            className="text-sm font-body mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Signals you&apos;ve saved for later reference.
          </p>
        </div>

        {error && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--accent-red)" }}>
              Failed to load bookmarks.
            </p>
          </GlassCard>
        )}

        {isLoading && !data && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          </GlassCard>
        )}

        {data && data.items.length === 0 && (
          <GlassCard>
            <div className="text-center py-6">
              <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                No bookmarks yet. Click the bookmark icon on any signal to save it for later.
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

        {data && data.items.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {data.items.map((b) => (
              <SignalCard
                key={b.signal.id}
                signal={toLegacySignal(b.signal)}
                showTakeSignal
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
