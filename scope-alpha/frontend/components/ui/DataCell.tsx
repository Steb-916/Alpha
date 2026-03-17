"use client";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";

interface DataCellProps {
  label: string;
  value: string;
  change?: number;
  subtitle?: string;
  color?: string;
  className?: string;
}

export function DataCell({ label, value, change, subtitle, color, className }: DataCellProps) {
  return (
    <div className={cn("bg-white/[0.02] rounded-lg p-3 border border-white/[0.04]", className)}>
      <div className="text-[10px] text-text-muted font-mono uppercase tracking-wider mb-1.5">{label}</div>
      <div className="text-lg font-bold font-mono" style={{ color: color || "var(--text-primary)" }}>
        {value}
      </div>
      {change !== undefined && (
        <div className={cn("text-xs font-mono mt-1", change >= 0 ? "text-positive" : "text-negative")}>
          {formatPercent(change)}
        </div>
      )}
      {subtitle && <div className="text-[9px] text-text-dim font-mono mt-1">{subtitle}</div>}
    </div>
  );
}
