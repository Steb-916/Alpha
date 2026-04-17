"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { VolOverview } from "@/components/volatility/VolOverview";
import { VolSurfaceHeatmap } from "@/components/volatility/VolSurfaceHeatmap";
import { RNDView } from "@/components/volatility/RNDView";
import { SkewView } from "@/components/volatility/SkewView";
import { TermStructureView } from "@/components/volatility/TermStructureView";
import { VolConeView } from "@/components/volatility/VolConeView";
import { VRPView } from "@/components/volatility/VRPView";
import { GEXView } from "@/components/volatility/GEXView";
import { GEXHeatmap } from "@/components/volatility/GEXHeatmap";
import { DEXView } from "@/components/volatility/DEXView";
import { VannaCharmView } from "@/components/volatility/VannaCharmView";
import { FlowScannerView } from "@/components/volatility/FlowScannerView";

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Vol Surface", value: "surface" },
  { label: "RND", value: "rnd" },
  { label: "Skew", value: "skew" },
  { label: "Term", value: "term" },
  { label: "Vol Cone", value: "cone" },
  { label: "VRP", value: "vrp" },
  { label: "GEX", value: "gex" },
  { label: "GEX Heatmap", value: "gex_heatmap" },
  { label: "DEX", value: "dex" },
  { label: "Vanna / Charm", value: "vanna_charm" },
  { label: "Flow", value: "flow" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const OPTIONS_ASSETS = new Set(["BTC", "ETH"]);

function VolatilityInner() {
  const params = useSearchParams();
  const view = (params.get("view") as TabValue) || "overview";
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const asset = OPTIONS_ASSETS.has(selectedAsset) ? selectedAsset : "BTC";

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 shrink-0 px-1">
        <nav className="flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const active = tab.value === view;
            return (
              <Link
                key={tab.value}
                href={
                  tab.value === "overview"
                    ? "/terminal/volatility"
                    : `/terminal/volatility?view=${tab.value}`
                }
                className="px-3 py-1.5 text-xs font-body rounded-[var(--radius-sm)] whitespace-nowrap"
                style={{
                  color: active ? "var(--accent-green)" : "var(--text-secondary)",
                  background: active ? "rgba(0, 212, 170, 0.08)" : "transparent",
                  border: active
                    ? "1px solid var(--accent-green)"
                    : "1px solid var(--glass-border)",
                  transition: "all 0.2s ease",
                }}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        {!OPTIONS_ASSETS.has(selectedAsset) && (
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Options data available for BTC and ETH only — showing {asset}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {view === "overview" && <VolOverview asset={asset} />}
        {view === "surface" && <VolSurfaceHeatmap asset={asset} />}
        {view === "rnd" && <RNDView asset={asset} />}
        {view === "skew" && <SkewView asset={asset} />}
        {view === "term" && <TermStructureView asset={asset} />}
        {view === "cone" && <VolConeView asset={asset} />}
        {view === "vrp" && <VRPView asset={asset} />}
        {view === "gex" && <GEXView asset={asset} />}
        {view === "gex_heatmap" && <GEXHeatmap asset={asset} />}
        {view === "dex" && <DEXView asset={asset} />}
        {view === "vanna_charm" && <VannaCharmView asset={asset} />}
        {view === "flow" && <FlowScannerView asset={asset} />}
      </div>
    </div>
  );
}

export default function VolatilityPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div
            className="w-8 h-8 border-2 rounded-full"
            style={{
              borderColor: "var(--glass-border)",
              borderTopColor: "var(--accent-green)",
              animation: "spin 1s linear infinite",
            }}
          />
        </div>
      }
    >
      <VolatilityInner />
    </Suspense>
  );
}
