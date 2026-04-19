"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { SupplyDynamicsView } from "@/components/onchain/SupplyDynamicsView";
import { ExchangeFlowsView } from "@/components/onchain/ExchangeFlowsView";
import { NetworkHealthView } from "@/components/onchain/NetworkHealthView";
import { StablecoinFlowsView } from "@/components/onchain/StablecoinFlowsView";
import { WhaleMonitorView } from "@/components/onchain/WhaleMonitorView";
import type { OnChainAsset } from "@/types/onchain";

const TABS = [
  { label: "Exchange Flows", value: "flows" },
  { label: "Supply Dynamics", value: "supply" },
  { label: "Network Health", value: "network" },
  { label: "Stablecoins", value: "stablecoins" },
  { label: "Whale Monitor", value: "whales" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const ONCHAIN_ASSETS = new Set(["BTC", "ETH"]);

function OnchainInner() {
  const params = useSearchParams();
  const view = (params.get("view") as TabValue) || "supply";
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const asset = ONCHAIN_ASSETS.has(selectedAsset)
    ? (selectedAsset as OnChainAsset)
    : ("BTC" as OnChainAsset);

  return (
    <div className="h-full flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2 shrink-0 px-1">
        <nav className="flex gap-1 overflow-x-auto scrollbar-thin">
          {TABS.map((tab) => {
            const active = tab.value === view;
            return (
              <Link
                key={tab.value}
                href={`/terminal/onchain?view=${tab.value}`}
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
        {!ONCHAIN_ASSETS.has(selectedAsset) && view !== "stablecoins" && (
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            On-chain data available for BTC and ETH only — showing {asset}
          </span>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {view === "flows" && <ExchangeFlowsView asset={asset} />}
        {view === "supply" && <SupplyDynamicsView asset={asset} />}
        {view === "network" && <NetworkHealthView asset={asset} />}
        {view === "stablecoins" && <StablecoinFlowsView />}
        {view === "whales" && <WhaleMonitorView asset={asset} />}
      </div>
    </div>
  );
}

export default function OnchainPage() {
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
      <OnchainInner />
    </Suspense>
  );
}
