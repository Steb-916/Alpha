"use client";

import type { CorrelationMatrixRow } from "@/types/macro";

interface Props {
  matrix: CorrelationMatrixRow[];
}

// Each row in matrix represents one macro asset; extract its single correlation value
function getCorr(row: CorrelationMatrixRow, window: "30d" | "90d"): number | null {
  const c = window === "30d" ? row.correlations_30d : row.correlations_90d;
  const key = row.asset.toLowerCase() as keyof typeof c;
  return c[key] ?? null;
}

function corrColor(v: number | null): string {
  if (v === null) return "rgba(255,255,255,0.06)";
  const t = (v + 1) / 2; // 0..1
  if (t >= 0.5) {
    const intensity = (t - 0.5) * 2;
    return `rgba(34,${Math.round(140 + intensity * 57)},94,${0.25 + intensity * 0.55})`;
  }
  const intensity = (0.5 - t) * 2;
  return `rgba(${Math.round(180 + intensity * 59)},68,68,${0.25 + intensity * 0.55})`;
}

function corrLabel(v: number | null): string {
  if (v === null) return "—";
  return (v >= 0 ? "+" : "") + v.toFixed(2);
}

function corrText(v: number | null): string {
  if (v === null) return "var(--text-muted)";
  if (Math.abs(v) > 0.5) return "var(--text-primary)";
  return "var(--text-secondary)";
}

export function CorrelationHeatmap({ matrix }: Props) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header row */}
      <div
        className="grid text-[10px] font-mono pb-1 border-b"
        style={{
          gridTemplateColumns: "1fr 90px 90px",
          borderColor: "var(--border)",
          color: "var(--text-muted)",
        }}
      >
        <span>BTC vs</span>
        <span className="text-center">30d Rolling</span>
        <span className="text-center">90d Rolling</span>
      </div>

      {/* Data rows */}
      {matrix.map((row) => {
        const v30 = getCorr(row, "30d");
        const v90 = getCorr(row, "90d");

        return (
          <div
            key={row.asset}
            className="grid items-center"
            style={{ gridTemplateColumns: "1fr 90px 90px" }}
          >
            <span
              className="text-xs font-bold"
              style={{ color: "var(--text-primary)" }}
            >
              {row.label}
            </span>

            {[v30, v90].map((v, i) => (
              <div key={i} className="flex justify-center">
                <span
                  className="px-2.5 py-1 rounded text-[11px] font-semibold tabular-nums"
                  style={{
                    background: corrColor(v),
                    color: corrText(v),
                    minWidth: 52,
                    textAlign: "center",
                  }}
                >
                  {corrLabel(v)}
                </span>
              </div>
            ))}
          </div>
        );
      })}

      <div
        className="text-[10px] font-mono mt-1"
        style={{ color: "var(--text-muted)" }}
      >
        Pearson correlation on daily log returns · green = positive · red = negative · Source: Yahoo Finance
      </div>
    </div>
  );
}
