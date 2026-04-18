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
import { GexByStrikeView } from "@/components/volatility/microstructure/GexByStrikeView";
import { GexHeatmapView } from "@/components/volatility/microstructure/GexHeatmapView";
import { DexByStrikeView } from "@/components/volatility/microstructure/DexByStrikeView";
import { VannaCharmView } from "@/components/volatility/microstructure/VannaCharmView";
import { MaxPainPinRiskView } from "@/components/volatility/microstructure/MaxPainPinRiskView";
import { OptionsFlowView } from "@/components/volatility/microstructure/OptionsFlowView";
import { CascadeRiskView } from "@/components/volatility/microstructure/CascadeRiskView";

const GROUP_TABS = [
  { label: "Volatility", value: "vol" },
  { label: "Microstructure", value: "micro" },
] as const;

const VOL_TABS = [
  { label: "Overview", value: "overview" },
  { label: "Vol Surface", value: "surface" },
  { label: "RND", value: "rnd" },
  { label: "Skew", value: "skew" },
  { label: "Term", value: "term" },
  { label: "Vol Cone", value: "cone" },
  { label: "VRP", value: "vrp" },
] as const;

const MICRO_TABS = [
  { label: "GEX", value: "gex" },
  { label: "GEX Heatmap", value: "gex-heatmap" },
  { label: "DEX", value: "dex" },
  { label: "Vanna / Charm", value: "vanna-charm" },
  { label: "Max Pain", value: "max-pain" },
  { label: "Flow", value: "flow" },
  { label: "Cascade Risk", value: "cascade" },
] as const;

type GroupValue = (typeof GROUP_TABS)[number]["value"];
type VolTabValue = (typeof VOL_TABS)[number]["value"];
type MicroTabValue = (typeof MICRO_TABS)[number]["value"];

const OPTIONS_ASSETS = new Set(["BTC", "ETH"]);

function tabLinkHref(group: GroupValue, view: string): string {
  const params = new URLSearchParams();
  if (group !== "vol") params.set("group", group);
  if (group === "vol" && view !== "overview") params.set("view", view);
  if (group === "micro") params.set("view", view);
  const q = params.toString();
  return q ? `/terminal/volatility?${q}` : "/terminal/volatility";
}

function NavTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
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
      {label}
    </Link>
  );
}

function VolatilityInner() {
  const params = useSearchParams();
  const groupParam = params.get("group") as GroupValue | null;
  const group: GroupValue = groupParam === "micro" ? "micro" : "vol";
  const viewParam = params.get("view") ?? "";
  const selectedAsset = useAppStore((s) => s.selectedAsset);
  const asset = OPTIONS_ASSETS.has(selectedAsset) ? selectedAsset : "BTC";

  const activeVolTab: VolTabValue =
    group === "vol" &&
    VOL_TABS.some((t) => t.value === viewParam)
      ? (viewParam as VolTabValue)
      : "overview";

  const activeMicroTab: MicroTabValue =
    group === "micro" &&
    MICRO_TABS.some((t) => t.value === viewParam)
      ? (viewParam as MicroTabValue)
      : "gex";

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Group selector row */}
      <div className="flex items-center justify-between gap-2 shrink-0 px-1">
        <nav className="flex gap-1">
          {GROUP_TABS.map((g) => (
            <NavTab
              key={g.value}
              href={tabLinkHref(
                g.value,
                g.value === "vol" ? "overview" : "gex",
              )}
              active={group === g.value}
              label={g.label}
            />
          ))}
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

      {/* Sub-tab row */}
      <div className="flex items-center gap-1 shrink-0 px-1 flex-wrap">
        {group === "vol"
          ? VOL_TABS.map((tab) => (
              <NavTab
                key={tab.value}
                href={tabLinkHref("vol", tab.value)}
                active={activeVolTab === tab.value}
                label={tab.label}
              />
            ))
          : MICRO_TABS.map((tab) => (
              <NavTab
                key={tab.value}
                href={tabLinkHref("micro", tab.value)}
                active={activeMicroTab === tab.value}
                label={tab.label}
              />
            ))}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0">
        {group === "vol" && activeVolTab === "overview" && <VolOverview asset={asset} />}
        {group === "vol" && activeVolTab === "surface" && <VolSurfaceHeatmap asset={asset} />}
        {group === "vol" && activeVolTab === "rnd" && <RNDView asset={asset} />}
        {group === "vol" && activeVolTab === "skew" && <SkewView asset={asset} />}
        {group === "vol" && activeVolTab === "term" && <TermStructureView asset={asset} />}
        {group === "vol" && activeVolTab === "cone" && <VolConeView asset={asset} />}
        {group === "vol" && activeVolTab === "vrp" && <VRPView asset={asset} />}

        {group === "micro" && activeMicroTab === "gex" && <GexByStrikeView asset={asset} />}
        {group === "micro" && activeMicroTab === "gex-heatmap" && <GexHeatmapView asset={asset} />}
        {group === "micro" && activeMicroTab === "dex" && <DexByStrikeView asset={asset} />}
        {group === "micro" && activeMicroTab === "vanna-charm" && <VannaCharmView asset={asset} />}
        {group === "micro" && activeMicroTab === "max-pain" && <MaxPainPinRiskView asset={asset} />}
        {group === "micro" && activeMicroTab === "flow" && <OptionsFlowView asset={asset} />}
        {group === "micro" && activeMicroTab === "cascade" && <CascadeRiskView asset={asset} />}
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
