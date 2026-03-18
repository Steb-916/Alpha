"use client";
import { cn } from "@/lib/utils";
import { formatPercent } from "@/lib/utils";

const REGIME_COLORS: Record<string, { bg: string; color: string }> = {
  "Risk On":    { bg: "rgba(16, 185, 129, 0.12)", color: "#10B981" },
  "Risk Off":   { bg: "rgba(239, 68, 68, 0.12)",  color: "#EF4444" },
  "Neutral":    { bg: "rgba(148, 163, 184, 0.12)", color: "#94A3B8" },
  "Cautious":   { bg: "rgba(245, 158, 11, 0.12)", color: "#F59E0B" },
  "Overheated": { bg: "rgba(249, 115, 22, 0.12)", color: "#F97316" },
};

function RegimeBadge({ text }: { text: string }) {
  const style = REGIME_COLORS[text];
  if (style) {
    return (
      <span
        className="inline-block mt-1 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
        style={{ background: style.bg, color: style.color }}
      >
        {text}
      </span>
    );
  }
  return <div className="text-[9px] font-mono mt-1" style={{ color: "var(--text-muted)" }}>{text}</div>;
}

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
    <div
      className={cn(
        "rounded-[var(--radius-md)] p-3 border transition-all duration-300",
        className
      )}
      style={{
        background: "var(--glass-bg)",
        backdropFilter: "blur(12px) saturate(150%)",
        WebkitBackdropFilter: "blur(12px) saturate(150%)",
        borderColor: "var(--glass-border)",
        boxShadow: "inset 0 1px 1px rgba(255,255,255,0.15)",
      }}
    >
      <div className="font-mono uppercase mb-1" style={{ color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.08em" }}>
        {label}
      </div>
      <div className="font-bold font-mono" style={{ color: color || "var(--text-primary)", fontSize: "22px", lineHeight: 1.1 }}>
        {value}
      </div>
      {change !== undefined && (
        <div className={cn("text-xs font-mono mt-1")} style={{ color: change >= 0 ? "var(--positive)" : "var(--negative)" }}>
          {formatPercent(change)}
        </div>
      )}
      {subtitle && <RegimeBadge text={subtitle} />}
    </div>
  );
}
