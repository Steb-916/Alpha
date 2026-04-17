"use client";

import { useMemo, useState } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useSkew } from "@/hooks/useSkew";
import { UnavailableBanner } from "./UnavailableBanner";
import { GlassPill } from "@/components/ui/GlassPill";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { SKEW_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 200;
const MARGIN = 12;

interface SkewViewProps {
  asset: string;
}

export function SkewView({ asset }: SkewViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useSkew(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);
  const [expiryDays, setExpiryDays] = useState<number | null>(null);

  const items = useMemo(
    () =>
      (data?.by_expiry ?? []).map((b) => ({
        label: `${Math.round(b.expiry_days)}d`,
        value: String(b.expiry_days),
      })),
    [data],
  );

  const active = useMemo(() => {
    if (!data) return null;
    const days = expiryDays ?? data.by_expiry[0]?.expiry_days;
    return data.by_expiry.find((b) => b.expiry_days === days) ?? null;
  }, [data, expiryDays]);

  const smileChart = useMemo(() => {
    if (!active) return null;
    const smile = [...active.smile].sort((a, b) => a.delta - b.delta);
    if (smile.length < 2) return null;
    const deltas = smile.map((s) => s.delta);
    const ivs = smile.map((s) => s.iv);
    const minD = Math.min(...deltas);
    const maxD = Math.max(...deltas);
    const minI = Math.min(...ivs);
    const maxI = Math.max(...ivs);
    const xOf = (d: number) =>
      MARGIN + ((d - minD) / (maxD - minD || 1)) * (WIDTH - 2 * MARGIN);
    const yOf = (i: number) =>
      HEIGHT - MARGIN - ((i - minI) / (maxI - minI || 1)) * (HEIGHT - 2 * MARGIN);
    const line = smile
      .map((s, i) => `${i === 0 ? "M" : "L"}${xOf(s.delta)},${yOf(s.iv)}`)
      .join(" ");
    return { line, deltas, minI, maxI };
  }, [active]);

  const termBar = useMemo(() => {
    if (!data) return null;
    const points = data.by_expiry.map((b) => ({
      expiry_days: b.expiry_days,
      skew: b.skew_25d,
    }));
    if (points.length === 0) return null;
    const skews = points.map((p) => p.skew);
    const minS = Math.min(...skews, 0);
    const maxS = Math.max(...skews, 0);
    const range = maxS - minS || 1;
    return { points, minS, maxS, range };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={SKEW_STAGES} title="Computing skew" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Skew"
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between gap-3">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          IV Skew & Smile
        </h2>
        <GlassPill
          items={items}
          activeValue={
            String(expiryDays ?? data.by_expiry[0]?.expiry_days ?? "")
          }
          onChange={(v) => setExpiryDays(Number(v))}
        />
      </div>

      {active && smileChart && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Smile — {Math.round(active.expiry_days)}d expiry
          </div>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full"
            style={{ height: HEIGHT }}
            preserveAspectRatio="none"
          >
            <path
              d={smileChart.line}
              fill="none"
              stroke="var(--accent-green)"
              strokeWidth={2}
            />
            {active.smile.map((s) => {
              const xOf = (d: number) => {
                const minD = Math.min(...smileChart.deltas);
                const maxD = Math.max(...smileChart.deltas);
                return MARGIN + ((d - minD) / (maxD - minD || 1)) * (WIDTH - 2 * MARGIN);
              };
              const yOf = (i: number) =>
                HEIGHT - MARGIN -
                ((i - smileChart.minI) / (smileChart.maxI - smileChart.minI || 1)) *
                  (HEIGHT - 2 * MARGIN);
              return (
                <circle
                  key={`${s.delta}-${s.iv}`}
                  cx={xOf(s.delta)}
                  cy={yOf(s.iv)}
                  r={3}
                  fill="var(--accent-green)"
                >
                  <title>
                    Δ {s.delta.toFixed(2)} → IV {s.iv.toFixed(1)}%
                  </title>
                </circle>
              );
            })}
          </svg>
          <div
            className="flex justify-between text-[10px] font-mono mt-1"
            style={{ color: "var(--text-muted)" }}
          >
            <span>Δ {Math.min(...smileChart.deltas).toFixed(2)} (OTM puts)</span>
            <span>ATM</span>
            <span>Δ {Math.max(...smileChart.deltas).toFixed(2)} (OTM calls)</span>
          </div>
        </GlassCard>
      )}

      {termBar && (
        <GlassCard>
          <div
            className="text-xs font-mono uppercase tracking-wider mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            25-Delta Risk Reversal across Expirations
          </div>
          <div className="space-y-1.5">
            {termBar.points.map((p) => {
              const pct = ((p.skew - termBar.minS) / termBar.range) * 100;
              const color =
                p.skew < -3
                  ? "var(--data-red)"
                  : p.skew < 0
                    ? "var(--data-yellow)"
                    : "var(--data-green)";
              return (
                <div key={p.expiry_days} className="flex items-center gap-2">
                  <span
                    className="text-[10px] font-mono w-10 text-right"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {Math.round(p.expiry_days)}d
                  </span>
                  <div
                    className="flex-1 h-4 rounded-sm relative"
                    style={{ background: "var(--glass-bg)" }}
                  >
                    <div
                      className="absolute top-0 left-0 h-full rounded-sm"
                      style={{ width: `${pct}%`, background: color, opacity: 0.7 }}
                    />
                  </div>
                  <span
                    className="text-[10px] font-mono w-14 text-right"
                    style={{ color }}
                  >
                    {p.skew.toFixed(2)}
                  </span>
                </div>
              );
            })}
          </div>
        </GlassCard>
      )}

      {active && (
        <GlassCard>
          <p
            className="text-sm font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            {active.skew_25d < -3 ? (
              <>
                Put skew is <strong style={{ color: "var(--data-red)" }}>elevated at {active.skew_25d.toFixed(1)}</strong>{" "}
                for the {Math.round(active.expiry_days)}-day tenor, indicating the
                market is paying a premium for downside protection.
              </>
            ) : active.skew_25d > 3 ? (
              <>
                Call skew is elevated at{" "}
                <strong style={{ color: "var(--data-green)" }}>+{active.skew_25d.toFixed(1)}</strong>{" "}
                for {Math.round(active.expiry_days)}-day options — upside demand is
                firm.
              </>
            ) : (
              <>
                25-delta skew is near zero — the market is pricing calls and puts
                symmetrically.
              </>
            )}
          </p>
        </GlassCard>
      )}
    </div>
  );
}
