"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import type { PlotParams } from "react-plotly.js";
import { GlassCard } from "@/components/ui/GlassCard";
import { GlassPill } from "@/components/ui/GlassPill";
import type { VolSurfaceOutput } from "@/types/options";

// Plotly must be client-side only — SSR will fail with "window is not defined"
const Plot = dynamic<PlotParams>(() => import("react-plotly.js"), { ssr: false });

type IVMode = "fitted" | "raw";
type XMode = "strike" | "delta";

interface Props {
  data: VolSurfaceOutput;
}

const IV_MODE_ITEMS = [
  { label: "Fitted", value: "fitted" },
  { label: "Raw", value: "raw" },
] as const;

const X_MODE_ITEMS = [
  { label: "Strike", value: "strike" },
  { label: "Delta", value: "delta" },
] as const;

// Green → Yellow → Red matching the app's data colour tokens
const COLORSCALE: [number, string][] = [
  [0.00, "#00d4aa"],
  [0.45, "#22c55e"],
  [0.65, "#eab308"],
  [1.00, "#ef4444"],
];

export function VolSurface3D({ data }: Props) {
  const [ivMode, setIvMode] = useState<IVMode>("fitted");
  const [xMode, setXMode] = useState<XMode>("strike");

  // ── Build Plotly surface matrices ──────────────────────────────────────────
  const { xValues, yValues, zMatrix, xLabel } = useMemo(() => {
    const strikes = Array.from(
      new Set(data.surface.map((p) => p.strike)),
    ).sort((a, b) => a - b);

    const expiries = Array.from(
      new Set(data.surface.map((p) => p.expiry_days)),
    ).sort((a, b) => a - b);

    // Fast lookup: "strike|expiry_days" → point
    const lookup = new Map<string, typeof data.surface[0]>();
    for (const p of data.surface) {
      lookup.set(`${p.strike}|${p.expiry_days}`, p);
    }

    // z[expiry_idx][strike_idx] — null for missing cells (Plotly renders as gap)
    const zMatrix: (number | null)[][] = expiries.map((exp) =>
      strikes.map((k) => {
        const pt = lookup.get(`${k}|${exp}`);
        if (!pt) return null;
        return ivMode === "fitted" ? pt.fitted_iv : pt.raw_iv;
      }),
    );

    // X axis values
    let xValues: number[];
    let xLabel: string;
    if (xMode === "strike") {
      xValues = strikes;
      xLabel = "Strike ($)";
    } else {
      // Average delta across expiries per strike (approximate — good enough for display)
      xValues = strikes.map((k) => {
        const deltas = expiries
          .map((exp) => lookup.get(`${k}|${exp}`)?.delta)
          .filter((d): d is number => d != null);
        if (deltas.length === 0) return 0.5;
        return Math.round((deltas.reduce((s, d) => s + d, 0) / deltas.length) * 100) / 100;
      });
      xLabel = "Delta";
    }

    return { xValues, yValues: expiries, zMatrix, xLabel };
  }, [data.surface, ivMode, xMode]);

  // ── Plotly layout (dark glass theme) ──────────────────────────────────────
  const layout: PlotParams["layout"] = {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { l: 0, r: 0, t: 4, b: 0 },
    font: { color: "#94a3b8", size: 10 },
    scene: {
      xaxis: {
        title: { text: xLabel },
        gridcolor: "#1e293b",
        zerolinecolor: "#1e293b",
        backgroundcolor: "rgba(15,15,25,0.6)",
        showbackground: true,
        tickfont: { size: 9 },
      },
      yaxis: {
        title: { text: "Days to Expiry" },
        gridcolor: "#1e293b",
        zerolinecolor: "#1e293b",
        backgroundcolor: "rgba(15,15,25,0.6)",
        showbackground: true,
        tickfont: { size: 9 },
      },
      zaxis: {
        title: { text: "IV (%)" },
        gridcolor: "#1e293b",
        zerolinecolor: "#1e293b",
        backgroundcolor: "rgba(15,15,25,0.6)",
        showbackground: true,
        tickfont: { size: 9 },
      },
      bgcolor: "rgba(0,0,0,0)",
      camera: { eye: { x: 1.6, y: -1.6, z: 0.9 } },
      aspectmode: "manual",
      aspectratio: { x: 1.4, y: 1, z: 0.7 },
    },
    autosize: true,
  };

  const plotData: PlotParams["data"] = [
    {
      type: "surface" as const,
      x: xValues,
      y: yValues,
      z: zMatrix,
      colorscale: COLORSCALE,
      showscale: true,
      colorbar: {
        title: { text: "IV %" },
        thickness: 12,
        len: 0.7,
        tickfont: { color: "#94a3b8", size: 9 },
        bgcolor: "rgba(0,0,0,0)",
        bordercolor: "#1e293b",
        borderwidth: 1,
      },
      hovertemplate:
        xMode === "strike"
          ? `Strike: $%{x:,.0f}<br>Expiry: %{y}d<br>IV: %{z:.1f}%<extra></extra>`
          : `Delta: %{x:.2f}<br>Expiry: %{y}d<br>IV: %{z:.1f}%<extra></extra>`,
      opacity: 0.92,
      lighting: {
        ambient: 0.7,
        diffuse: 0.8,
        specular: 0.15,
        roughness: 0.6,
        fresnel: 0.3,
      },
      lightposition: { x: 1000, y: 1000, z: 5000 },
    },
  ];

  const config: PlotParams["config"] = {
    displayModeBar: true,
    modeBarButtonsToRemove: [
      "toImage",
      "sendDataToCloud",
      "select2d",
      "lasso2d",
    ] as Parameters<typeof config>["modeBarButtonsToRemove"],
    displaylogo: false,
    responsive: true,
  };

  return (
    <div className="h-full flex flex-col gap-3 overflow-hidden">
      {/* Header + controls */}
      <div className="flex items-center justify-between gap-3 shrink-0 px-1">
        <h2
          className="text-sm font-bold font-display"
          style={{ color: "var(--text-primary)" }}
        >
          {data.asset} Implied Volatility Surface
        </h2>
        <div className="flex items-center gap-2">
          <GlassPill
            items={IV_MODE_ITEMS as unknown as { label: string; value: string }[]}
            activeValue={ivMode}
            onChange={(v) => setIvMode(v as IVMode)}
          />
          <GlassPill
            items={X_MODE_ITEMS as unknown as { label: string; value: string }[]}
            activeValue={xMode}
            onChange={(v) => setXMode(v as XMode)}
          />
        </div>
      </div>

      {/* 3D plot */}
      <GlassCard noPadding className="flex-1 min-h-0 overflow-hidden">
        <div className="w-full h-full" style={{ minHeight: 420 }}>
          <Plot
            data={plotData}
            layout={layout}
            config={config}
            style={{ width: "100%", height: "100%" }}
            useResizeHandler
          />
        </div>
      </GlassCard>

      {/* Stats footer */}
      <div
        className="flex flex-wrap gap-x-5 gap-y-1 text-[10px] font-mono shrink-0 px-1"
        style={{ color: "var(--text-muted)" }}
      >
        <span>
          Spot{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            ${data.spot_price.toLocaleString()}
          </span>
        </span>
        <span>
          Fit{" "}
          <span style={{ color: "var(--accent-green)" }}>
            {data.fit_quality.method}
          </span>
        </span>
        <span>
          RMSE{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            {data.fit_quality.rmse.toFixed(2)}
          </span>
        </span>
        <span>
          Max residual{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            {data.fit_quality.max_residual.toFixed(2)}
          </span>
        </span>
        <span>
          Computed{" "}
          <span style={{ color: "var(--text-secondary)" }}>
            {data.computed_at.slice(0, 16).replace("T", " ")} UTC
          </span>
        </span>
        {(data as typeof data & { _stale?: boolean })._stale && (
          <span
            className="px-1.5 py-0.5 rounded"
            style={{
              background: "rgba(234,179,8,0.1)",
              color: "var(--data-yellow)",
              border: "1px solid var(--data-yellow)",
            }}
          >
            stale
          </span>
        )}
      </div>
    </div>
  );
}
