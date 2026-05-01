"use client";

import useSWR from "swr";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import type { NetworkHealthData } from "@/lib/onchain/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function fmtHash(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)} ZH/s`;
  if (v >= 1) return `${v.toFixed(1)} EH/s`;
  return `${(v * 1000).toFixed(0)} PH/s`;
}

function fmtCount(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e6) return `${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString();
}

function fmtUsd(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${(v * 1e8).toFixed(0)} sats`;
}

function dateLabel(ts: string): string {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface Props {
  asset: string;
}

export function NetworkHealthPanel({ asset }: Props) {
  const { data, error, isLoading } = useSWR<NetworkHealthData>(
    `/api/market/onchain/network-health?asset=${asset}`,
    fetcher,
    { refreshInterval: 60 * 60 * 1000 },
  );

  if (isLoading) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
      </GlassCard>
    );
  }

  if (error || !data || "error" in data) {
    return (
      <GlassCard>
        <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Network health data unavailable
        </p>
      </GlassCard>
    );
  }

  const isBTC = asset === "BTC";
  const chartData = data.history.map((p) => ({
    date: dateLabel(p.timestamp),
    value: isBTC ? (p.hashRate ?? 0) : (p.txCount ?? 0),
    fee: p.avgFeeUsd,
  }));

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2 className="text-sm font-bold font-display shrink-0" style={{ color: "var(--text-primary)" }}>
        Network Health — {asset}
      </h2>

      {/* Stat cards */}
      <div className="grid grid-cols-3 gap-3 shrink-0">
        {isBTC && (
          <GlassCard>
            <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
              Hash Rate
            </div>
            <div className="text-2xl font-bold font-mono" style={{ color: "var(--accent-green)" }}>
              {fmtHash(data.current.hashRate)}
            </div>
            <p className="text-[10px] font-body mt-1" style={{ color: "var(--text-muted)" }}>
              Mining security — higher is stronger
            </p>
          </GlassCard>
        )}
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Daily Transactions
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: "var(--text-primary)" }}>
            {fmtCount(data.current.txCount)}
          </div>
          <p className="text-[10px] font-body mt-1" style={{ color: "var(--text-muted)" }}>
            On-chain activity (24h)
          </p>
        </GlassCard>
        <GlassCard>
          <div className="text-[10px] font-mono uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Avg Fee (USD)
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: "var(--data-yellow)" }}>
            {fmtUsd(data.current.avgFeeUsd)}
          </div>
          <p className="text-[10px] font-body mt-1" style={{ color: "var(--text-muted)" }}>
            {isBTC ? "Per transaction" : "Per tx (gas)"}
          </p>
        </GlassCard>
      </div>

      {/* Trend chart */}
      <GlassCard className="flex-1 min-h-0">
        <div className="text-[10px] font-mono uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
          {isBTC ? "Hash Rate Trend (30d)" : "Transaction Count Trend (30d)"}
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="nhGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              interval={6}
            />
            <YAxis
              tick={{ fontSize: 9, fill: "var(--text-muted)", fontFamily: "var(--font-mono)" }}
              tickLine={false}
              axisLine={false}
              width={45}
              tickFormatter={(v) => isBTC ? fmtHash(v) : fmtCount(v)}
            />
            <Tooltip
              contentStyle={{
                background: "var(--glass-bg)",
                border: "1px solid var(--glass-border)",
                borderRadius: "var(--radius-sm)",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
                color: "var(--text-primary)",
              }}
              formatter={(v: number) => [isBTC ? fmtHash(v) : fmtCount(v), isBTC ? "Hash Rate" : "Transactions"]}
            />
            <Area
              type="monotone"
              dataKey="value"
              stroke="var(--accent-green)"
              strokeWidth={1.5}
              fill="url(#nhGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </GlassCard>
    </div>
  );
}
