"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { AnalystCard } from "@/lib/marketplace";

interface Props {
  analyst: AnalystCard;
}

function MiniSparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (data.length < 2) return null;
  const W = 80;
  const H = 28;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#10B981" : "#EF4444"}
        strokeWidth={1.5}
      />
    </svg>
  );
}

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalf = rating - fullStars >= 0.3;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          className="text-[10px]"
          style={{
            color:
              i < fullStars
                ? "#F59E0B"
                : i === fullStars && hasHalf
                ? "#F59E0B"
                : "var(--text-tertiary)",
            opacity: i < fullStars || (i === fullStars && hasHalf) ? 1 : 0.3,
          }}
        >
          ★
        </span>
      ))}
      <span className="text-[10px] font-mono ml-1" style={{ color: "var(--text-secondary)" }}>
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

export function AnalystCardItem({ analyst }: Props) {
  const isPositive = analyst.totalPnl90d >= 0;

  return (
    <Link href={`/analyst/${analyst.slug}`} className="block no-underline">
      <div
        className="p-4 rounded-[var(--radius-md)] transition-all cursor-pointer group"
        style={{
          background: "var(--glass-bg)",
          border: "1px solid var(--glass-border)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "rgba(0, 212, 170, 0.3)";
          e.currentTarget.style.background = "rgba(0, 212, 170, 0.03)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = "var(--glass-border)";
          e.currentTarget.style.background = "var(--glass-bg)";
        }}
      >
        {/* Header row: avatar + name + price */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold font-display shrink-0"
              style={{
                background: "linear-gradient(135deg, rgba(0,212,170,0.25), rgba(0,212,170,0.08))",
                border: "1.5px solid rgba(0, 212, 170, 0.35)",
                color: "var(--accent-green)",
              }}
            >
              {analyst.avatarInitial}
            </div>
            <div>
              <h3 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
                {analyst.displayName}
              </h3>
              <div className="flex items-center gap-1.5 mt-0.5">
                {analyst.primaryAssets.slice(0, 3).map((a) => (
                  <span
                    key={a}
                    className="text-[9px] font-mono px-1 py-0.5 rounded"
                    style={{
                      background: "rgba(0, 212, 170, 0.08)",
                      color: "var(--accent-green)",
                      border: "1px solid rgba(0, 212, 170, 0.15)",
                    }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-sm font-mono font-bold" style={{ color: "var(--accent-green)" }}>
              ${analyst.priceUsd}
            </span>
            <span className="text-[10px] font-body block" style={{ color: "var(--text-muted)" }}>
              /month
            </span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div>
            <span className="text-[9px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
              Win Rate
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: analyst.winRate90d >= 60 ? "#10B981" : "var(--text-primary)" }}
            >
              {analyst.winRate90d}%
            </span>
          </div>
          <div>
            <span className="text-[9px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
              P&L (90d)
            </span>
            <span
              className="text-xs font-mono font-bold"
              style={{ color: isPositive ? "#10B981" : "#EF4444" }}
            >
              {isPositive ? "+" : ""}
              {analyst.totalPnl90d}%
            </span>
          </div>
          <div>
            <span className="text-[9px] font-body uppercase tracking-wider block" style={{ color: "var(--text-tertiary)" }}>
              Subs
            </span>
            <span className="text-xs font-mono font-bold" style={{ color: "var(--text-primary)" }}>
              {analyst.subscriberCount.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Bottom row: sparkline + rating + active signals */}
        <div className="flex items-center justify-between">
          <MiniSparkline data={analyst.sparkline} positive={isPositive} />
          <div className="flex items-center gap-3">
            <StarRating rating={analyst.avgRating} />
            <Badge variant="blue">{analyst.activeSignals} active</Badge>
          </div>
        </div>
      </div>
    </Link>
  );
}
