"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { OnChainOverview } from "@/components/onchain/OnChainOverview";
import { ExchangeFlowChart } from "@/components/onchain/ExchangeFlowChart";
import { MVRVSOPRChart } from "@/components/onchain/MVRVSOPRChart";
import { SupplyDynamicsChart } from "@/components/onchain/SupplyDynamicsChart";
import { StablecoinFlowChart } from "@/components/onchain/StablecoinFlowChart";

const TABS = [
  { label: "Overview", value: "overview" },
  { label: "Exchange Flows", value: "flows" },
  { label: "MVRV / SOPR / NVT", value: "valuation" },
  { label: "Supply Dynamics", value: "supply" },
  { label: "Stablecoin Flows", value: "stablecoins" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const ONCHAIN_ASSETS = new Set(["BTC", "ETH"]);

function tabHref(view: string): string {
  if (view === "overview") return "/terminal/onchain";
  return `/terminal/onchain?view=${view}`;
}

function NavTab({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      className="px-3 py-1.5 text-xs font-body rounded-[var(--radius-sm)]"
      style={{
        color: active ? "var(--accent-green)" : "var(--text-secondary)",
        background: active ? "rgba(0, 212, 170, 0.08)" : "transparent",
        border: active ? "1px solid var(--accent-green)" : "1px solid var(--glass-border)",
        transition: "all 0.2s ease",
      }}
    >
      {label}
    </Link>
  );
}

function OnChainInner() {
  const params = useSearchParams();
  const viewParam = params.get("view") ?? "overview";
  const activeTab: TabValue = TABS.some((t) => t.value === viewParam)
    ? (viewParam as TabValue)
    : "overview";

  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const asset = ONCHAIN_ASSETS.has(selectedAsset) ? selectedAsset : "BTC";

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Tab row */}
      <div className="flex items-center justify-between gap-2 shrink-0 px-1">
        <nav className="flex gap-1 flex-wrap">
          {TABS.map((tab) => (
            <NavTab
              key={tab.value}
              href={tabHref(tab.value)}
              active={activeTab === tab.value}
              label={tab.label}
            />
          ))}
        </nav>
        {!ONCHAIN_ASSETS.has(selectedAsset) && (
          <span
            className="text-[10px] font-mono uppercase tracking-widest shrink-0"
            style={{ color: "var(--text-muted)" }}
          >
            On-chain data: BTC and ETH only — showing {asset}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "overview" && <OnChainOverview asset={asset} />}
        {activeTab === "flows" && <ExchangeFlowChart asset={asset} />}
        {activeTab === "valuation" && <MVRVSOPRChart asset={asset} />}
        {activeTab === "supply" && <SupplyDynamicsChart asset={asset} />}
        {activeTab === "stablecoins" && <StablecoinFlowChart />}
      </div>
    </div>
  );
}

export default function OnChainPage() {
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
      <OnChainInner />
    </Suspense>
  );
}
