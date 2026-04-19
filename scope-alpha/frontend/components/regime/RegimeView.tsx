"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useRegime } from "@/hooks/useRegime";
import { useRegimeHistory } from "@/hooks/useRegimeHistory";
import {
  REGIME_COLORS,
  REGIME_LABELS,
} from "@/lib/regime/regime-colors";
import type { OnChainAsset } from "@/types/onchain";
import { FeatureContributionsPanel } from "./FeatureContributionsPanel";
import { ForwardReturnsTable } from "./ForwardReturnsTable";
import { RegimeTimelineHeatmap } from "./RegimeTimelineHeatmap";

interface Props {
  asset: OnChainAsset;
}

export function RegimeView({ asset }: Props) {
  const {
    data: regime,
    isLoading,
    unavailable,
    quantEngineConfigured,
  } = useRegime(asset);
  const {
    data: history,
    isLoading: historyLoading,
  } = useRegimeHistory(asset, 90);

  if (isLoading) {
    return (
      <GlassCard>
        <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
          Classifying regime…
        </div>
      </GlassCard>
    );
  }

  if (unavailable || !regime?.classification || !regime.feature_vector) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Regime Classifier"
      />
    );
  }

  const { classification, feature_vector, days_in_regime } = regime;
  const regimeColor = REGIME_COLORS[classification.committed_regime];
  const regimeLabel = REGIME_LABELS[classification.committed_regime];
  const confidencePct = Math.round(classification.confidence * 100);
  const isLowConfidence = confidencePct < 50;

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          Regime — {asset}
        </h2>
        {regime.staleness === "stale" && (
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

      {/* Regime badge card */}
      <GlassCard>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Current regime
            </div>
            <div className="flex items-center gap-3">
              <span
                className="px-3 py-1 rounded-[var(--radius-pill)] text-sm font-bold font-mono uppercase tracking-wider"
                style={{
                  background: "var(--glass-bg)",
                  color: regimeColor,
                  border: `1px solid ${regimeColor}`,
                }}
              >
                {regimeLabel}
              </span>
              <span
                className="text-xs font-mono"
                style={{ color: "var(--text-secondary)" }}
              >
                {confidencePct}% confidence
              </span>
              {isLowConfidence && (
                <span
                  className="px-2 py-0.5 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
                  style={{
                    background: "var(--glass-bg)",
                    color: "var(--data-yellow)",
                    border: "1px solid var(--data-yellow)",
                  }}
                  title="Available features don't strongly support any regime — check convergence dashboard (Slice 2)"
                >
                  Contested signal
                </span>
              )}
            </div>
          </div>
          <div className="text-right">
            <div
              className="text-[10px] font-mono uppercase tracking-wider mb-1"
              style={{ color: "var(--text-muted)" }}
            >
              Days in regime
            </div>
            <div
              className="text-lg font-bold font-mono"
              style={{ color: "var(--text-primary)" }}
            >
              {days_in_regime != null ? `${days_in_regime}d` : "—"}
            </div>
          </div>
        </div>
        <p
          className="text-xs font-body mt-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {classification.reasoning}
        </p>
        {classification.raw_classification !== classification.committed_regime && (
          <p
            className="text-[10px] font-mono mt-2"
            style={{ color: "var(--text-muted)" }}
          >
            Regime changes confirm after 1–2 days — the classifier commits a
            new regime only after two consecutive daily observations agree.
            Raw classifier returned <em>{classification.raw_classification}</em>{" "}
            this run; holding {regimeLabel} until the next run agrees.
          </p>
        )}
      </GlassCard>

      {/* Timeline heatmap */}
      {historyLoading ? (
        <GlassCard>
          <div className="text-xs font-mono" style={{ color: "var(--text-muted)" }}>
            Loading timeline…
          </div>
        </GlassCard>
      ) : (
        <RegimeTimelineHeatmap points={history?.points ?? []} days={history?.days ?? 90} />
      )}

      {/* Feature contributions */}
      <FeatureContributionsPanel
        featureVector={feature_vector}
        featureSupport={classification.feature_support}
      />

      {/* Forward returns */}
      <ForwardReturnsTable asset={asset} regime={classification.committed_regime} />

      {/* Disclosures */}
      <GlassCard>
        <p
          className="text-[10px] font-mono leading-relaxed"
          style={{ color: "var(--text-muted)" }}
        >
          Rules-based classifier — five regime states with a 2-of-2 persistence
          filter. Confidence is the fraction of available features supporting
          the classified regime. Rules and weights are heuristic v1 — expect
          tuning as the persisted history deepens. Hourly cadence requires a
          Vercel Pro plan; daily is the Hobby-plan baseline, so regime
          transitions take 1–2 days to commit on this deployment. Analytics,
          not financial advice.
        </p>
      </GlassCard>
    </div>
  );
}
