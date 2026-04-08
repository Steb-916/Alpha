"use client";

/**
 * Activity feed page.
 *
 * Tabs: All / Signals / Milestones / Following (auth only).
 * Pagination via cursor + "Load more" button.
 */

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { useSession } from "next-auth/react";
import { FeedItem, type FeedItemData } from "@/components/feed/FeedItem";
import { GlassCard } from "@/components/ui/GlassCard";

type Tab = "all" | "signals" | "milestones" | "following";

const TABS: { key: Tab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "signals", label: "Signals" },
  { key: "milestones", label: "Milestones" },
  { key: "following", label: "Following" },
];

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export default function FeedPage() {
  const { data: session } = useSession();
  const [tab, setTab] = useState<Tab>("all");

  const url =
    tab === "following"
      ? "/api/feed/following?limit=20"
      : `/api/feed?filter=${tab}&limit=20`;

  const { data, error, isLoading } = useSWR<{
    items: FeedItemData[];
    nextCursor: string | null;
  }>(url, fetcher);

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
          /feed
        </span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8 space-y-4">
        <div>
          <h1
            className="text-2xl font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Activity Feed
          </h1>
          <p
            className="text-sm font-body mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            Live stream of signals, resolutions, and analyst milestones across the platform.
          </p>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2">
          {TABS.map((t) => {
            const disabled = t.key === "following" && !session?.user?.id;
            const active = tab === t.key && !disabled;
            return (
              <button
                key={t.key}
                type="button"
                disabled={disabled}
                onClick={() => setTab(t.key)}
                className="px-4 py-2 text-xs font-bold font-body cursor-pointer rounded-[var(--radius-pill)]"
                style={{
                  background: active
                    ? "rgba(0, 212, 170, 0.15)"
                    : "var(--glass-bg)",
                  color: active
                    ? "var(--accent-green)"
                    : disabled
                      ? "var(--text-tertiary)"
                      : "var(--text-secondary)",
                  border: `1px solid ${active ? "rgba(0, 212, 170, 0.3)" : "var(--glass-border)"}`,
                  opacity: disabled ? 0.5 : 1,
                  cursor: disabled ? "not-allowed" : "pointer",
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        {error && (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--accent-red)" }}>
              Failed to load feed.
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
                {tab === "following"
                  ? "Follow some analysts to populate your personalized feed."
                  : "No events yet. Activity will appear here as analysts publish signals."}
              </p>
              {tab === "following" && (
                <Link
                  href="/marketplace"
                  className="inline-block mt-3 px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
                  style={{ background: "var(--accent-green)", color: "#fff" }}
                >
                  Browse marketplace →
                </Link>
              )}
            </div>
          </GlassCard>
        )}

        {data?.items.map((item) => <FeedItem key={item.id} item={item} />)}
      </div>
    </div>
  );
}
