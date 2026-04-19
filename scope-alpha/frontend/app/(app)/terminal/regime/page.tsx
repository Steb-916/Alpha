"use client";

import { Suspense } from "react";
import { useAppStore } from "@/lib/store";
import { RegimeView } from "@/components/regime/RegimeView";
import { GlassCard } from "@/components/ui/GlassCard";
import type { OnChainAsset } from "@/types/onchain";

const REGIME_ASSETS = new Set(["BTC", "ETH"]);

function RegimeInner() {
  const selectedAsset = useAppStore((s) => s.selectedAsset);

  // Explicit unsupported-asset state per approved plan — don't silently
  // fall back to BTC. The selector and the rendered content always agree.
  if (!REGIME_ASSETS.has(selectedAsset)) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <GlassCard className="max-w-lg text-center">
          <div
            className="text-sm font-bold font-display mb-2"
            style={{ color: "var(--text-primary)" }}
          >
            Regime classifier not available for {selectedAsset}
          </div>
          <p
            className="text-xs font-body leading-relaxed"
            style={{ color: "var(--text-secondary)" }}
          >
            Regime classification requires options + on-chain data that Scope
            Alpha only sources for BTC and ETH in v1. Switch to BTC or ETH in
            the top asset selector to continue.
          </p>
          <div
            className="mt-3 inline-block px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
            style={{
              background: "var(--glass-bg)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-muted)",
            }}
          >
            BTC · ETH only
          </div>
        </GlassCard>
      </div>
    );
  }

  return <RegimeView asset={selectedAsset as OnChainAsset} />;
}

export default function RegimePage() {
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
      <RegimeInner />
    </Suspense>
  );
}
