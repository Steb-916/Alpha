"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useWhaleTransactions } from "@/hooks/useWhaleTransactions";
import type {
  OnChainAsset,
  TransferClassification,
  WhaleTransactionRecord,
} from "@/types/onchain";

interface WhaleMonitorViewProps {
  asset: OnChainAsset;
}

const THRESHOLD_USD: Record<OnChainAsset, number> = {
  BTC: 1_000_000,
  ETH: 500_000,
};

const CLASS_COLORS: Record<TransferClassification, string> = {
  to_exchange: "var(--data-red)",
  from_exchange: "var(--data-green)",
  wallet_to_wallet: "var(--text-muted)",
};

const CLASS_LABELS: Record<TransferClassification, string> = {
  to_exchange: "→ Exchange",
  from_exchange: "← Exchange",
  wallet_to_wallet: "Wallet ↔",
};

function formatUsd(v: number): string {
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `$${(v / 1e3).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function ago(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function labelFor(
  label: string | null,
  address: string,
): string {
  if (label) return label[0].toUpperCase() + label.slice(1);
  if (!address) return "unknown";
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WhaleMonitorView({ asset }: WhaleMonitorViewProps) {
  const { data, isLoading } = useWhaleTransactions(asset);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Loading whale transactions…
        </div>
      </GlassCard>
    );
  }

  const providerConfigured = data?.provider_configured ?? false;
  const recent = data?.recent ?? [];

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Whale Monitor — {asset}
        </h2>
        <span
          className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            color: "var(--text-muted)",
            border: "1px solid var(--glass-border)",
          }}
        >
          threshold {formatUsd(THRESHOLD_USD[asset])}+
        </span>
      </div>

      {!providerConfigured && (
        <GlassCard>
          <p
            className="text-xs font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            Whale Alert is not configured. Set{" "}
            <code>WHALE_ALERT_API_KEY</code> in the environment to enable
            real-time large-transfer tracking.
          </p>
        </GlassCard>
      )}

      <GlassCard>
        <p
          className="text-[11px] font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Exchange classification based on a curated seed list of known hot
          wallets (version {data?.seedListVersion ?? "unknown"}). Unknown
          addresses are not attributed — sparsity in the table is expected
          until the list expands.
        </p>
      </GlassCard>

      {data && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Last 24h summary
          </div>
          <div className="grid grid-cols-4 gap-2">
            <SummaryStat label="Transfers" value={data.summary24h.total.toString()} />
            <SummaryStat
              label="To exchanges"
              value={formatUsd(data.summary24h.toExchangeUsd)}
              color={CLASS_COLORS.to_exchange}
            />
            <SummaryStat
              label="From exchanges"
              value={formatUsd(data.summary24h.fromExchangeUsd)}
              color={CLASS_COLORS.from_exchange}
            />
            <SummaryStat
              label="Wallet-to-wallet"
              value={formatUsd(data.summary24h.walletToWalletUsd)}
            />
          </div>
        </GlassCard>
      )}

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          Recent transfers
        </div>
        {recent.length === 0 ? (
          <p
            className="text-sm font-body text-center py-6"
            style={{ color: "var(--text-secondary)" }}
          >
            No whale transfers{providerConfigured ? " in the recent buffer" : ""}.
          </p>
        ) : (
          <table className="w-full text-xs font-mono">
            <thead>
              <tr
                style={{
                  color: "var(--text-muted)",
                  borderBottom: "1px solid var(--glass-border)",
                }}
              >
                <th className="text-left py-1 pr-3">Time</th>
                <th className="text-right pr-3">Amount</th>
                <th className="text-left pr-3">Flow</th>
                <th className="text-right">Class</th>
              </tr>
            </thead>
            <tbody>
              {recent.slice(0, 25).map((t: WhaleTransactionRecord, i) => {
                const color = CLASS_COLORS[t.classification];
                return (
                  <tr
                    key={`${t.txHash}-${i}`}
                    style={{ borderBottom: "1px solid rgba(148,163,184,0.07)" }}
                  >
                    <td className="py-1 pr-3" style={{ color: "var(--text-secondary)" }}>
                      {ago(t.timestamp)}
                    </td>
                    <td
                      className="text-right pr-3"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {formatUsd(t.valueUsd)}
                    </td>
                    <td className="py-1 pr-3" style={{ color: "var(--text-secondary)" }}>
                      {labelFor(t.fromLabel, t.fromAddress)} →{" "}
                      {labelFor(t.toLabel, t.toAddress)}
                    </td>
                    <td className="text-right" style={{ color }}>
                      {CLASS_LABELS[t.classification]}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </GlassCard>
    </div>
  );
}

function SummaryStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div>
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-sm font-bold font-mono"
        style={{ color: color ?? "var(--text-primary)" }}
      >
        {value}
      </div>
    </div>
  );
}
