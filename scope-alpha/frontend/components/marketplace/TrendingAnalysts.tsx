"use client";

/**
 * Trending analysts row — top analysts by new-subscriber count over a window.
 *
 * Silently hides when the API returns no data (fresh demo state with no
 * recent subscriptions). The full implementation lands in Step 4.
 */

import useSWR from "swr";

interface TrendingAnalyst {
  slug: string;
  displayName: string;
  avatarInitial: string;
  newSubscribers: number;
  totalSubscribers: number;
  winRate: number;
  totalPnl: number;
  lowestTierPrice: number;
}

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

export function TrendingAnalysts() {
  const { data } = useSWR<{ analysts: TrendingAnalyst[] }>(
    "/api/analysts/trending?period=7d&limit=5",
    fetcher,
    { revalidateOnFocus: false },
  );

  const analysts = data?.analysts ?? [];
  if (analysts.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span
          className="text-[10px] font-bold font-body uppercase tracking-wider"
          style={{ color: "var(--text-tertiary)" }}
        >
          🔥 Trending this week
        </span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {analysts.map((a) => (
          <a
            key={a.slug}
            href={`/analyst/${a.slug}`}
            className="flex-shrink-0 w-64 p-3 rounded-[var(--radius-md)] no-underline"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid rgba(245, 158, 11, 0.3)",
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                style={{
                  background: "linear-gradient(135deg, rgba(245,158,11,0.3), rgba(245,158,11,0.1))",
                  color: "#F59E0B",
                  border: "1.5px solid rgba(245, 158, 11, 0.4)",
                }}
              >
                {a.avatarInitial}
              </div>
              <div className="flex-1 min-w-0">
                <div
                  className="text-xs font-bold font-display truncate"
                  style={{ color: "var(--text-primary)" }}
                >
                  {a.displayName}
                </div>
                <div
                  className="text-[10px] font-mono"
                  style={{ color: "#F59E0B" }}
                >
                  +{a.newSubscribers} new this week
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-[10px] font-mono">
              <span style={{ color: "var(--text-secondary)" }}>
                Win {a.winRate.toFixed(0)}%
              </span>
              <span style={{ color: a.totalPnl >= 0 ? "#10B981" : "#EF4444" }}>
                {a.totalPnl >= 0 ? "+" : ""}
                {a.totalPnl.toFixed(1)}%
              </span>
              <span style={{ color: "var(--accent-green)" }}>
                ${a.lowestTierPrice}/mo
              </span>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
