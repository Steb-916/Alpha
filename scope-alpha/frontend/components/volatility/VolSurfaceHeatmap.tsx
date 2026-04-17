"use client";

import { useMemo } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import { useVolSurface } from "@/hooks/useVolSurface";
import { UnavailableBanner } from "./UnavailableBanner";
import {
  ComputeLoader,
  useDelayedLoadingSignal,
} from "./ComputeLoader";
import { VOL_SURFACE_STAGES } from "@/lib/options/loading-stages";

interface VolSurfaceHeatmapProps {
  asset: string;
}

function ivColor(iv: number, min: number, max: number): string {
  if (max === min) return "rgba(59, 130, 246, 0.4)";
  const t = Math.max(0, Math.min(1, (iv - min) / (max - min)));
  // Green → Yellow → Red gradient
  if (t < 0.5) {
    const localT = t * 2;
    const r = Math.round(34 + (234 - 34) * localT);
    const g = Math.round(197 + (179 - 197) * localT);
    const b = Math.round(94 + (8 - 94) * localT);
    return `rgba(${r}, ${g}, ${b}, 0.75)`;
  }
  const localT = (t - 0.5) * 2;
  const r = Math.round(234 + (239 - 234) * localT);
  const g = Math.round(179 + (68 - 179) * localT);
  const b = Math.round(8 + (68 - 8) * localT);
  return `rgba(${r}, ${g}, ${b}, 0.75)`;
}

export function VolSurfaceHeatmap({ asset }: VolSurfaceHeatmapProps) {
  const { data, isLoading, unavailable, quantEngineConfigured } =
    useVolSurface(asset);
  const showLoader = useDelayedLoadingSignal(isLoading);

  const grid = useMemo(() => {
    if (!data) return null;
    const strikes = Array.from(
      new Set(data.surface.map((p) => p.strike)),
    ).sort((a, b) => a - b);
    const expiries = Array.from(
      new Set(data.surface.map((p) => p.expiry_days)),
    ).sort((a, b) => a - b);
    const ivs = data.surface.map((p) => p.fitted_iv);
    const min = Math.min(...ivs);
    const max = Math.max(...ivs);
    const lookup = new Map<string, number>();
    for (const p of data.surface) {
      lookup.set(`${p.strike}|${p.expiry_days}`, p.fitted_iv);
    }
    return { strikes, expiries, min, max, lookup };
  }, [data]);

  if (isLoading) {
    return showLoader ? (
      <ComputeLoader
        stages={VOL_SURFACE_STAGES}
        title="Fitting vol surface"
      />
    ) : (
      <div className="h-full" />
    );
  }

  if (unavailable) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Vol Surface"
      />
    );
  }

  if (!data || !grid || grid.strikes.length === 0) {
    return (
      <UnavailableBanner
        quantEngineConfigured={quantEngineConfigured}
        tool="Vol Surface"
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
          {asset} Implied Volatility Surface
        </h2>
        <div
          className="text-[10px] font-mono uppercase tracking-widest"
          style={{ color: "var(--text-muted)" }}
        >
          Method: {data.fit_quality.method} · RMSE{" "}
          {data.fit_quality.rmse.toFixed(2)}
        </div>
      </div>
      <GlassCard noPadding>
        <div className="overflow-auto p-3">
          <table className="text-[10px] font-mono">
            <thead>
              <tr>
                <th
                  className="px-2 py-1 text-right"
                  style={{ color: "var(--text-muted)" }}
                >
                  Strike \ Days
                </th>
                {grid.expiries.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-1 text-center"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {d.toFixed(0)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {grid.strikes.map((k) => (
                <tr key={k}>
                  <td
                    className="px-2 py-1 text-right"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    ${k.toLocaleString()}
                  </td>
                  {grid.expiries.map((d) => {
                    const iv = grid.lookup.get(`${k}|${d}`);
                    if (iv == null) {
                      return (
                        <td
                          key={d}
                          className="px-2 py-1 text-center"
                          style={{ color: "var(--text-muted)" }}
                        >
                          —
                        </td>
                      );
                    }
                    return (
                      <td
                        key={d}
                        className="px-2 py-1 text-center"
                        title={`IV ${iv.toFixed(1)}%`}
                        style={{
                          background: ivColor(iv, grid.min, grid.max),
                          color: "var(--text-primary)",
                        }}
                      >
                        {iv.toFixed(0)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
      <div
        className="text-[10px] font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        Heatmap shows fitted annualized IV % at each (strike, days-to-expiry).
        Cell color: green = low IV, yellow = mid, red = high.
      </div>
    </div>
  );
}
