"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useSkew } from "@/hooks/useSkew";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { TERM_STAGES } from "@/lib/options/loading-stages";

const WIDTH = 800;
const HEIGHT = 220;
const MARGIN = 14;

interface TermStructureViewProps {
  asset: string;
}

export function TermStructureView({ asset }: TermStructureViewProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } = useSkew(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const chart = useMemo(() => {
    if (!data) return null;
    const ts = [...data.term_structure].sort(
      (a, b) => a.expiry_days - b.expiry_days,
    );
    if (ts.length < 2) return null;
    const days = ts.map((t) => t.expiry_days);
    const ivs = ts.map((t) => t.atm_iv);
    const minD = Math.min(...days);
    const maxD = Math.max(...days);
    const minI = Math.min(...ivs);
    const maxI = Math.max(...ivs);
    const xOf = (d: number) =>
      MARGIN + ((d - minD) / (maxD - minD || 1)) * (WIDTH - 2 * MARGIN);
    const yOf = (i: number) =>
      HEIGHT - MARGIN - ((i - minI) / (maxI - minI || 1)) * (HEIGHT - 2 * MARGIN);
    const line = ts
      .map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.expiry_days)},${yOf(p.atm_iv)}`)
      .join(" ");
    return { ts, line, xOf, yOf, minI, maxI };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader stages={TERM_STAGES} title="Building term structure" />
    ) : (
      <div className="h-full" />
    );
  }
  if (unavailable || !data || !chart) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Term Structure"
      />
    );
  }

  return (
    <div className="h-full flex flex-col gap-3 overflow-auto">
      <div className="flex items-center justify-between">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          IV Term Structure — {asset}
        </h2>
        <span
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{
            color:
              data.term_structure_shape === "contango"
                ? "var(--accent-green)"
                : data.term_structure_shape === "backwardation"
                  ? "var(--data-red)"
                  : "var(--text-muted)",
          }}
        >
          {data.term_structure_shape}
        </span>
      </div>
      <GlassCard>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full"
          style={{ height: HEIGHT }}
          preserveAspectRatio="none"
        >
          <path d={chart.line} fill="none" stroke="var(--accent-green)" strokeWidth={2} />
          {chart.ts.map((p) => (
            <circle
              key={p.expiry_days}
              cx={chart.xOf(p.expiry_days)}
              cy={chart.yOf(p.atm_iv)}
              r={3}
              fill="var(--accent-green)"
            >
              <title>
                {p.expiry_days}d → IV {p.atm_iv.toFixed(1)}%
              </title>
            </circle>
          ))}
        </svg>
        <div
          className="flex justify-between text-[10px] font-mono mt-1"
          style={{ color: "var(--text-muted)" }}
        >
          {chart.ts.map((p) => (
            <span key={p.expiry_days}>{Math.round(p.expiry_days)}d</span>
          ))}
        </div>
      </GlassCard>
      <GlassCard>
        <p
          className="text-sm font-body"
          style={{ color: "var(--text-secondary)" }}
        >
          Term structure is{" "}
          <strong style={{ color: "var(--text-primary)" }}>
            {data.term_structure_shape}
          </strong>
          {data.term_structure_shape === "contango"
            ? " — longer-dated options are more expensive, indicating no near-term stress."
            : data.term_structure_shape === "backwardation"
              ? " — shorter-dated options are more expensive, indicating near-term stress."
              : " — IV is roughly flat across tenors."}
        </p>
      </GlassCard>
    </div>
  );
}
