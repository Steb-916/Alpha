"use client";

// Inline SVG charts for cumulative P&L and monthly returns
// No additional dependencies — pure React SVG

interface CumulativePnlChartProps {
  data: { date: string; pnl: number }[];
}

export function CumulativePnlChart({ data }: CumulativePnlChartProps) {
  if (data.length < 2) {
    return (
      <div
        className="flex items-center justify-center h-[180px] rounded-[var(--radius-md)]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          Not enough data for P&L chart
        </span>
      </div>
    );
  }

  const W = 500;
  const H = 160;
  const PAD = { top: 20, right: 20, bottom: 30, left: 50 };

  const values = data.map((d) => d.pnl);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;

  const xScale = (i: number) =>
    PAD.left + (i / (data.length - 1)) * (W - PAD.left - PAD.right);
  const yScale = (v: number) =>
    PAD.top + (1 - (v - minVal) / range) * (H - PAD.top - PAD.bottom);

  const zeroY = yScale(0);
  const lastVal = values[values.length - 1];
  const isPositive = lastVal >= 0;

  // Build path
  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xScale(i)} ${yScale(d.pnl)}`)
    .join(" ");

  // Fill path (area under the line to zero)
  const fillPath = `${linePath} L ${xScale(data.length - 1)} ${zeroY} L ${xScale(0)} ${zeroY} Z`;

  return (
    <div
      className="rounded-[var(--radius-md)] p-3"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <span
        className="text-[10px] font-bold font-body uppercase tracking-wider block mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Cumulative P&L
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {/* Zero line */}
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="var(--glass-border)"
          strokeWidth={1}
          strokeDasharray="4 2"
        />

        {/* Fill area */}
        <path
          d={fillPath}
          fill={isPositive ? "rgba(16, 185, 129, 0.08)" : "rgba(239, 68, 68, 0.08)"}
        />

        {/* Line */}
        <path
          d={linePath}
          fill="none"
          stroke={isPositive ? "#10B981" : "#EF4444"}
          strokeWidth={2}
        />

        {/* End dot */}
        <circle
          cx={xScale(data.length - 1)}
          cy={yScale(lastVal)}
          r={4}
          fill={isPositive ? "#10B981" : "#EF4444"}
        />

        {/* Y-axis labels */}
        <text
          x={PAD.left - 8}
          y={PAD.top + 4}
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          {maxVal.toFixed(1)}%
        </text>
        <text
          x={PAD.left - 8}
          y={H - PAD.bottom}
          fill="var(--text-muted)"
          fontSize={9}
          fontFamily="monospace"
          textAnchor="end"
        >
          {minVal.toFixed(1)}%
        </text>

        {/* Last value label */}
        <text
          x={xScale(data.length - 1)}
          y={yScale(lastVal) - 10}
          fill={isPositive ? "#10B981" : "#EF4444"}
          fontSize={11}
          fontFamily="monospace"
          fontWeight="bold"
          textAnchor="middle"
        >
          {lastVal >= 0 ? "+" : ""}
          {lastVal.toFixed(2)}%
        </text>
      </svg>
    </div>
  );
}

interface MonthlyReturnsChartProps {
  data: { month: string; pnl: number }[];
}

export function MonthlyReturnsChart({ data }: MonthlyReturnsChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center h-[180px] rounded-[var(--radius-md)]"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <span className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
          No monthly data yet
        </span>
      </div>
    );
  }

  const W = 500;
  const H = 160;
  const PAD = { top: 20, right: 20, bottom: 35, left: 50 };

  const values = data.map((d) => d.pnl);
  const minVal = Math.min(0, ...values);
  const maxVal = Math.max(0, ...values);
  const range = maxVal - minVal || 1;

  const barWidth = Math.min(
    40,
    (W - PAD.left - PAD.right) / data.length - 4
  );
  const zeroY =
    PAD.top + (1 - (0 - minVal) / range) * (H - PAD.top - PAD.bottom);

  return (
    <div
      className="rounded-[var(--radius-md)] p-3"
      style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
    >
      <span
        className="text-[10px] font-bold font-body uppercase tracking-wider block mb-2"
        style={{ color: "var(--text-tertiary)" }}
      >
        Monthly Returns
      </span>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
        {/* Zero line */}
        <line
          x1={PAD.left}
          y1={zeroY}
          x2={W - PAD.right}
          y2={zeroY}
          stroke="var(--glass-border)"
          strokeWidth={1}
        />

        {data.map((d, i) => {
          const x =
            PAD.left +
            ((i + 0.5) / data.length) * (W - PAD.left - PAD.right) -
            barWidth / 2;
          const barY =
            PAD.top +
            (1 - (Math.max(0, d.pnl) - minVal) / range) *
              (H - PAD.top - PAD.bottom);
          const barH = Math.abs(
            ((d.pnl) / range) * (H - PAD.top - PAD.bottom)
          );
          const isPos = d.pnl >= 0;

          return (
            <g key={d.month}>
              <rect
                x={x}
                y={isPos ? barY : zeroY}
                width={barWidth}
                height={Math.max(1, barH)}
                rx={2}
                fill={isPos ? "rgba(16, 185, 129, 0.6)" : "rgba(239, 68, 68, 0.6)"}
              />
              {/* Month label */}
              <text
                x={x + barWidth / 2}
                y={H - 8}
                fill="var(--text-muted)"
                fontSize={8}
                fontFamily="monospace"
                textAnchor="middle"
              >
                {d.month.slice(5)}
              </text>
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={isPos ? barY - 4 : zeroY + barH + 12}
                fill={isPos ? "#10B981" : "#EF4444"}
                fontSize={8}
                fontFamily="monospace"
                fontWeight="bold"
                textAnchor="middle"
              >
                {d.pnl > 0 ? "+" : ""}
                {d.pnl.toFixed(1)}%
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
