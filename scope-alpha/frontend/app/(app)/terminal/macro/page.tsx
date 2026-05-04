"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { CorrelationView } from "@/components/macro/CorrelationView";
import { EtfFlowView } from "@/components/macro/EtfFlowView";
import { RegimeView } from "@/components/macro/RegimeView";
import { ConvergenceView } from "@/components/macro/ConvergenceView";
import { TokenUnlockView } from "@/components/macro/TokenUnlockView";

const TABS = [
  { label: "Correlations",  value: "correlations" },
  { label: "ETF Flows",     value: "etf-flows" },
  { label: "Regime",        value: "regime" },
  { label: "Convergence",   value: "convergence" },
  { label: "Token Unlocks", value: "unlocks" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const MACRO_ASSETS = new Set(["BTC", "ETH"]);

function tabHref(view: string): string {
  if (view === "correlations") return "/terminal/macro";
  return `/terminal/macro?view=${view}`;
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

function MacroInner() {
  const params = useSearchParams();
  const viewParam = params.get("view") ?? "correlations";
  const activeTab: TabValue = TABS.some((t) => t.value === viewParam)
    ? (viewParam as TabValue)
    : "correlations";

  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const asset = MACRO_ASSETS.has(selectedAsset) ? selectedAsset : "BTC";

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Tab nav */}
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
        {!MACRO_ASSETS.has(selectedAsset) && (activeTab === "regime" || activeTab === "convergence") && (
          <span
            className="text-[10px] font-mono uppercase tracking-widest"
            style={{ color: "var(--text-muted)" }}
          >
            Regime &amp; Convergence available for BTC and ETH — showing {asset}
          </span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === "correlations" && <CorrelationView />}
        {activeTab === "etf-flows"    && <EtfFlowView />}
        {activeTab === "regime"       && <RegimeView asset={asset} />}
        {activeTab === "convergence"  && <ConvergenceView asset={asset} />}
        {activeTab === "unlocks"      && <TokenUnlockView />}
      </div>
    </div>
  );
}

export default function MacroPage() {
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
      <MacroInner />
    </Suspense>
  );
}
