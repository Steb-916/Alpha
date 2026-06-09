"use client";

import { GlassCard } from "@/components/ui/GlassCard";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function heatColor(pct: number): string {
  if (pct > 10) return "#10B981";
  if (pct > 5) return "#34D399";
  if (pct > 0) return "#6EE7B7";
  if (pct > -5) return "#FCA5A5";
  if (pct > -10) return "#F87171";
  return "#EF4444";
}

export function MonthlyHeatmap({ monthlyReturns }: { monthlyReturns: Record<string, number> }) {
  // Collect all years
  const keys = Object.keys(monthlyReturns).sort();
  if (keys.length === 0) return null;

  const years = [...new Set(keys.map((k) => k.slice(0, 4)))];

  return (
    <GlassCard noPadding>
      <div className="p-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
          MONTHLY RETURNS
        </p>
      </div>
      <div className="p-3 overflow-x-auto">
        <table className="text-[10px] font-mono w-full">
          <thead>
            <tr>
              <th className="text-left pr-3 pb-1.5" style={{ color: "var(--text-muted)" }}>Year</th>
              {MONTHS.map((m) => (
                <th key={m} className="text-center px-1 pb-1.5 min-w-[32px]" style={{ color: "var(--text-muted)" }}>
                  {m}
                </th>
              ))}
              <th className="text-right pl-3 pb-1.5" style={{ color: "var(--text-muted)" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {years.map((year) => {
              let yearTotal = 0;
              const cells = MONTHS.map((_, mi) => {
                const key = `${year}-${String(mi + 1).padStart(2, "0")}`;
                const val = monthlyReturns[key];
                if (val != null) yearTotal += val;
                return val;
              });

              return (
                <tr key={year}>
                  <td className="pr-3 py-0.5 font-semibold" style={{ color: "var(--text-secondary)" }}>
                    {year}
                  </td>
                  {cells.map((val, mi) => (
                    <td key={mi} className="text-center px-1 py-0.5">
                      {val != null ? (
                        <span
                          className="inline-block px-1 py-0.5 rounded text-[9px] font-bold min-w-[28px]"
                          style={{
                            background: `${heatColor(val)}22`,
                            color: heatColor(val),
                            border: `1px solid ${heatColor(val)}44`,
                          }}
                        >
                          {val >= 0 ? "+" : ""}{val.toFixed(1)}
                        </span>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  ))}
                  <td
                    className="text-right pl-3 py-0.5 font-semibold"
                    style={{ color: heatColor(yearTotal) }}
                  >
                    {yearTotal >= 0 ? "+" : ""}{yearTotal.toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </GlassCard>
  );
}
