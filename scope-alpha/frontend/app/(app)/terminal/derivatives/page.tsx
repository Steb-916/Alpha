"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { OverviewView } from "@/components/terminal/views/OverviewView";
import { FundingView } from "@/components/terminal/views/FundingView";
import { OIView } from "@/components/terminal/views/OIView";
import { LiquidationsView } from "@/components/terminal/views/LiquidationsView";
import { BasisView } from "@/components/terminal/views/BasisView";
import { ScreenerView } from "@/components/terminal/views/ScreenerView";
import { CrossExchangeView } from "@/components/terminal/views/CrossExchangeView";
import { useAppStore } from "@/lib/store";
import { useRegime } from "@/hooks/useRegime";
import {
  REGIME_COLORS,
  REGIME_LABELS_SHORT,
} from "@/lib/regime/regime-colors";
import type { OnChainAsset } from "@/types/onchain";

const REGIME_ASSETS = new Set(["BTC", "ETH"]);

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Funding", value: "funding" },
  { label: "Open Interest", value: "oi" },
  { label: "Liquidations", value: "liquidations" },
  { label: "Basis", value: "basis" },
  { label: "Cross-Exchange", value: "cross_exchange" },
  { label: "Screener", value: "screener" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

function DerivativesInner() {
  const params = useSearchParams();
  const view = (params.get("view") as TabValue) || "overview";

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 shrink-0 px-1">
        <nav className="flex gap-1">
          {TABS.map((tab) => {
            const active = tab.value === view;
            return (
              <Link
                key={tab.value}
                href={tab.value === "overview" ? "/terminal/derivatives" : `/terminal/derivatives?view=${tab.value}`}
                className="px-3 py-1.5 text-xs font-body rounded-[var(--radius-sm)]"
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
        <RegimeChip />
      </div>

      <div className="flex-1 min-h-0">
        {view === "overview" && <OverviewView />}
        {view === "funding" && <FundingView />}
        {view === "oi" && <OIView />}
        {view === "liquidations" && <LiquidationsView />}
        {view === "basis" && <BasisView />}
        {view === "cross_exchange" && <CrossExchangeView />}
        {view === "screener" && <ScreenerView />}
      </div>
    </div>
  );
}

/**
 * Phase 6 Slice 1 — light-touch regime breadcrumb. Shows the current
 * committed regime + confidence when Quant Engine is live and the selected
 * asset is BTC/ETH. Click navigates to the full Regime view. Hidden
 * otherwise — no reordering, no hidden content. Per PRD §6.4.
 */
function RegimeChip() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const regimeSupported = REGIME_ASSETS.has(selectedAsset);
  const { data, quantEngineConfigured } = useRegime(
    regimeSupported ? (selectedAsset as OnChainAsset) : ("BTC" as OnChainAsset),
  );

  if (!regimeSupported || !quantEngineConfigured || !data?.classification) {
    return null;
  }

  const regime = data.classification.committed_regime;
  const color = REGIME_COLORS[regime];
  const confidencePct = Math.round(data.classification.confidence * 100);

  return (
    <Link
      href="/terminal/regime"
      className="flex items-center gap-2 px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider shrink-0"
      style={{
        background: "var(--glass-bg)",
        color,
        border: `1px solid ${color}`,
        transition: "all 0.2s ease",
      }}
      title={`${data.classification.reasoning}`}
    >
      <span style={{ fontWeight: 700 }}>{REGIME_LABELS_SHORT[regime]}</span>
      <span style={{ color: "var(--text-muted)" }}>·</span>
      <span>{confidencePct}%</span>
    </Link>
  );
}

export default function DerivativesPage() {
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
      <DerivativesInner />
    </Suspense>
  );
}
