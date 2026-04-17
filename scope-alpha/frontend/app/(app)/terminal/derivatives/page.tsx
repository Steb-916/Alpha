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
      <nav className="flex gap-1 shrink-0 px-1">
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
