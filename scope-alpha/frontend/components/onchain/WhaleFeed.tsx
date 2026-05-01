"use client";

import { useState } from "react";
import useSWR from "swr";
import { GlassCard } from "@/components/ui/GlassCard";
import type { WhaleFeedData, WhaleTransaction } from "@/lib/onchain/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const MIN_VALUES = [
  { label: "$1M+", value: 1_000_000 },
  { label: "$10M+", value: 10_000_000 },
  { label: "$100M+", value: 100_000_000 },
];

function fmtUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

function timeAgo(ts: string): string {
  const diff = (Date.now() - new Date(ts).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

function typeColor(type: WhaleTransaction["type"]): string {
  if (type === "exchange_deposit") return "var(--data-red)";
  if (type === "exchange_withdrawal") return "var(--accent-green)";
  return "var(--text-secondary)";
}

function typeLabel(type: WhaleTransaction["type"]): string {
  if (type === "exchange_deposit") return "→ Exchange (Sell pressure)";
  if (type === "exchange_withdrawal") return "← From Exchange (Buy pressure)";
  return "Transfer";
}

function TransactionRow({ tx }: { tx: WhaleTransaction }) {
  return (
    <div
      className="flex items-center justify-between gap-3 py-2 px-3 rounded"
      style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid var(--glass-border)" }}
    >
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-center gap-2">
          <span
            className="text-xs font-bold font-mono"
            style={{ color: "var(--text-primary)" }}
          >
            {fmtUsd(tx.amountUsd)}
          </span>
          <span
            className="text-[10px] font-mono uppercase px-1 rounded"
            style={{
              color: typeColor(tx.type),
              background: `${typeColor(tx.type)}18`,
            }}
          >
            {tx.symbol}
          </span>
        </div>
        <span className="text-[10px] font-mono truncate" style={{ color: typeColor(tx.type) }}>
          {typeLabel(tx.type)}
        </span>
        {(tx.fromLabel || tx.toLabel) && (
          <span className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
            {tx.fromLabel && `From: ${tx.fromLabel}`}
            {tx.fromLabel && tx.toLabel && " → "}
            {tx.toLabel && `To: ${tx.toLabel}`}
          </span>
        )}
      </div>
      <span
        className="text-[10px] font-mono shrink-0"
        style={{ color: "var(--text-muted)" }}
      >
        {timeAgo(tx.timestamp)}
      </span>
    </div>
  );
}

interface Props {
  asset?: string;
}

export function WhaleFeed({ asset }: Props) {
  const [minValue, setMinValue] = useState(1_000_000);
  const assetParam = asset ? `&asset=${asset}` : "";

  const { data, error, isLoading } = useSWR<WhaleFeedData>(
    `/api/market/onchain/whale-feed?minValue=${minValue}${assetParam}`,
    fetcher,
    { refreshInterval: 5 * 60 * 1000 },
  );

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between shrink-0">
        <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Whale Monitor {asset ? `— ${asset}` : ""}
        </h2>
        <div className="flex gap-1">
          {MIN_VALUES.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setMinValue(opt.value)}
              className="px-2 py-1 text-[10px] font-mono rounded"
              style={{
                color: minValue === opt.value ? "var(--accent-green)" : "var(--text-muted)",
                background: minValue === opt.value ? "rgba(0,212,170,0.08)" : "transparent",
                border: `1px solid ${minValue === opt.value ? "var(--accent-green)" : "var(--glass-border)"}`,
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <GlassCard>
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>Loading…</p>
        </GlassCard>
      )}

      {(error || (data && "error" in data)) && (
        <GlassCard>
          <p className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Whale feed unavailable. Set WHALE_ALERT_API_KEY to enable live data.
          </p>
        </GlassCard>
      )}

      {data && !("error" in data) && (
        <GlassCard className="flex-1 min-h-0 overflow-auto p-0">
          {data.transactions.length === 0 ? (
            <p className="text-xs font-mono p-4" style={{ color: "var(--text-muted)" }}>
              No transactions above {fmtUsd(minValue)} in the last hour.
            </p>
          ) : (
            <div>
              {data.transactions.map((tx) => (
                <TransactionRow key={tx.id} tx={tx} />
              ))}
              <p className="text-[10px] font-mono p-2" style={{ color: "var(--text-muted)" }}>
                {(data as WhaleFeedData & { _mock?: boolean })._mock
                  ? "Sample data — set WHALE_ALERT_API_KEY for live transactions"
                  : `Updated ${timeAgo(data.fetchedAt)}`}
              </p>
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}
