"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useOnChainNetwork } from "@/hooks/useOnChainNetwork";
import type { OnChainAsset } from "@/types/onchain";

interface NetworkHealthViewProps {
  asset: OnChainAsset;
}

function formatNumber(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function formatUsd(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `$${formatNumber(n)}`;
}

export function NetworkHealthView({ asset }: NetworkHealthViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useOnChainNetwork(asset);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Fetching network metrics…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Network Health"
      />
    );
  }

  const { current } = data;
  const isBtc = asset === "BTC";

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Network Health — {asset}
        </h2>
        {data.staleness === "stale" && (
          <span
            className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "var(--glass-bg)",
              color: "var(--text-muted)",
              border: "1px solid var(--glass-border)",
            }}
          >
            Stale
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard
          label="Active addresses (24h)"
          value={formatNumber(current.activeAddresses)}
          sub="Daily unique addresses with any transfer activity"
        />
        <MetricCard
          label="Transactions (24h)"
          value={formatNumber(current.txCount)}
          sub="Daily on-chain transaction count"
        />
        <MetricCard
          label="Daily fees"
          value={isBtc ? formatUsd(current.feesUsd) : "—"}
          sub={
            isBtc
              ? "BTC block fees in USD (FeeTotNtv × PriceUSD)"
              : "ETH gas data requires an ETH-specific provider"
          }
          muted={!isBtc}
        />
        <MetricCard
          label="Daily issuance"
          value={formatUsd(current.issuanceUsd)}
          sub={
            isBtc
              ? "BTC block subsidy + fees in USD"
              : "ETH post-merge net issuance in USD"
          }
        />
      </div>

      <GlassCard>
        <div
          className="text-xs font-mono uppercase tracking-wider mb-2"
          style={{ color: "var(--text-muted)" }}
        >
          NVT
        </div>
        <p
          className="text-xs font-body leading-relaxed"
          style={{ color: "var(--text-secondary)" }}
        >
          NVT requires USD-denominated transfer volume, which is not on the
          CoinMetrics community tier. Available when an upgraded data tier is
          wired in (Glassnode / CryptoQuant). The NVT Quant Engine endpoint
          stub is in place for a minimal re-enable.
        </p>
      </GlassCard>

      <GlassCard>
        <p
          className="text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Data: CoinMetrics community (Active Addresses, Transaction Count,
          BTC Fees, Total Issuance). ETH gas metrics require an ETH-specific
          provider. Network Health does not depend on the Quant Engine —
          metrics pass through raw.
        </p>
      </GlassCard>
    </div>
  );
}

function MetricCard({
  label,
  value,
  sub,
  muted,
}: {
  label: string;
  value: string;
  sub: string;
  muted?: boolean;
}) {
  return (
    <GlassCard>
      <div
        className="text-[10px] font-mono uppercase tracking-wider mb-1"
        style={{ color: "var(--text-muted)" }}
      >
        {label}
      </div>
      <div
        className="text-lg font-bold font-mono mb-1"
        style={{
          color: muted ? "var(--text-muted)" : "var(--text-primary)",
        }}
      >
        {value}
      </div>
      <div
        className="text-[10px] font-body leading-tight"
        style={{ color: "var(--text-muted)" }}
      >
        {sub}
      </div>
    </GlassCard>
  );
}
