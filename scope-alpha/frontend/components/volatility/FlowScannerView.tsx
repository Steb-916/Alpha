"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useFlowScanner } from "@/hooks/useFlowScanner";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { FLOW_STAGES } from "@/lib/options/loading-stages";

interface FlowScannerViewProps {
  asset: string;
}

function formatUsd(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function significanceBadge(s: string) {
  if (s === "high") {
    return {
      label: "HIGH",
      bg: "rgba(239, 68, 68, 0.15)",
      fg: "var(--data-red)",
      border: "var(--data-red)",
    };
  }
  if (s === "medium") {
    return {
      label: "MED",
      bg: "rgba(234, 179, 8, 0.15)",
      fg: "var(--data-yellow)",
      border: "var(--data-yellow)",
    };
  }
  return {
    label: "LOW",
    bg: "var(--glass-bg)",
    fg: "var(--text-muted)",
    border: "var(--glass-border)",
  };
}

export function FlowScannerView({ asset }: FlowScannerViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useFlowScanner(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={FLOW_STAGES} title="Scanning options flow" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Options Flow Scanner"
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <h2
        className="text-sm font-bold font-display"
        style={{ color: "var(--text-primary)" }}
      >
        Options Flow Scanner
      </h2>

      <div className="grid grid-cols-3 gap-2">
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Call premium 24h
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--data-green)" }}
          >
            {formatUsd(data.summary.call_premium_usd)}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            Put premium 24h
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{ color: "var(--data-red)" }}
          >
            {formatUsd(data.summary.put_premium_usd)}
          </div>
        </GlassCard>
        <GlassCard>
          <div
            className="text-[10px] font-mono uppercase tracking-wider mb-1"
            style={{ color: "var(--text-muted)" }}
          >
            C/P ratio — {data.summary.bias}
          </div>
          <div
            className="text-sm font-bold font-mono"
            style={{
              color:
                data.summary.bias === "bullish"
                  ? "var(--data-green)"
                  : data.summary.bias === "bearish"
                    ? "var(--data-red)"
                    : "var(--text-muted)",
            }}
          >
            {data.summary.call_put_ratio.toFixed(2)}x
          </div>
        </GlassCard>
      </div>

      <GlassCard noPadding>
        <div className="p-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
          <div
            className="text-xs font-mono uppercase tracking-wider"
            style={{ color: "var(--text-muted)" }}
          >
            Unusual activity — top {data.anomalies.length}
          </div>
        </div>
        {data.anomalies.length === 0 ? (
          <div
            className="p-4 text-xs font-mono text-center"
            style={{ color: "var(--text-muted)" }}
          >
            No anomalies detected in the last 24h.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: "var(--glass-border)" }}>
            {data.anomalies.map((a) => {
              const badge = significanceBadge(a.significance);
              return (
                <div
                  key={`${a.instrument}-${a.anomaly_type}`}
                  className="p-3 flex items-start gap-3"
                  style={{ borderTop: "1px solid var(--glass-border)" }}
                >
                  <span
                    className="px-2 py-0.5 rounded-[var(--radius-sm)] text-[10px] font-mono font-bold shrink-0"
                    style={{
                      background: badge.bg,
                      color: badge.fg,
                      border: `1px solid ${badge.border}`,
                    }}
                  >
                    {badge.label}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-mono"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {a.instrument}{" "}
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        · {a.anomaly_type.replace("_", " ")}
                      </span>
                    </div>
                    <div
                      className="text-[11px] font-body mt-1"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {a.description}
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-mono shrink-0"
                    style={{
                      color:
                        a.sentiment === "bullish"
                          ? "var(--data-green)"
                          : a.sentiment === "bearish"
                            ? "var(--data-red)"
                            : "var(--text-muted)",
                    }}
                  >
                    {a.sentiment}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
