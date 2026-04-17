"use client";

import { Flame, Activity, TrendingUp } from "lucide-react";
import { useChartToolbar } from "@/lib/chartToolbarStore";

interface ToggleProps {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}

function Toggle({ active, onClick, icon, label }: ToggleProps) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm)] text-[11px] font-mono cursor-pointer"
      style={{
        background: active ? "rgba(0, 212, 170, 0.1)" : "var(--glass-bg)",
        border: `1px solid ${active ? "var(--accent-green)" : "var(--glass-border)"}`,
        color: active ? "var(--accent-green)" : "var(--text-secondary)",
        transition: "all 0.2s ease",
      }}
    >
      {icon}
      {label}
    </button>
  );
}

export function ChartToolbar() {
  const {
    showHeatmap,
    showCVD,
    showDivergences,
    toggleHeatmap,
    toggleCVD,
    toggleDivergences,
  } = useChartToolbar();

  return (
    <div className="flex items-center gap-2">
      <Toggle
        active={showHeatmap}
        onClick={toggleHeatmap}
        icon={<Flame size={12} strokeWidth={1.75} />}
        label="Heatmap"
      />
      <Toggle
        active={showCVD}
        onClick={toggleCVD}
        icon={<Activity size={12} strokeWidth={1.75} />}
        label="CVD"
      />
      <Toggle
        active={showDivergences}
        onClick={toggleDivergences}
        icon={<TrendingUp size={12} strokeWidth={1.75} />}
        label="Divergences"
      />
    </div>
  );
}
