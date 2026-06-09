"use client";

import { useEffect, useRef } from "react";
import { GlassCard } from "@/components/ui/GlassCard";
import type { EquityPoint } from "@/lib/analytics/backtest-engine";

export function EquityCurve({ data }: { data: EquityPoint[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const w = canvas.offsetWidth;
    const h = canvas.offsetHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.scale(dpr, dpr);

    const pad = { top: 12, right: 12, bottom: 28, left: 60 };
    const chartW = w - pad.left - pad.right;
    const chartH = h - pad.top - pad.bottom;

    const equities = data.map((d) => d.equity);
    const minEq = Math.min(...equities);
    const maxEq = Math.max(...equities);
    const eqRange = maxEq - minEq || 1;

    function xOf(i: number) { return pad.left + (i / (data.length - 1)) * chartW; }
    function yOf(v: number) { return pad.top + (1 - (v - minEq) / eqRange) * chartH; }

    ctx.clearRect(0, 0, w, h);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.05)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad.top + (i / 4) * chartH;
      ctx.beginPath();
      ctx.moveTo(pad.left, y);
      ctx.lineTo(pad.left + chartW, y);
      ctx.stroke();
      const val = maxEq - (i / 4) * eqRange;
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText("$" + val.toFixed(0), pad.left - 6, y + 4);
    }

    // Equity line
    const gradient = ctx.createLinearGradient(0, pad.top, 0, pad.top + chartH);
    gradient.addColorStop(0, "rgba(56,189,248,0.3)");
    gradient.addColorStop(1, "rgba(56,189,248,0.0)");

    ctx.beginPath();
    data.forEach((d, i) => {
      const x = xOf(i);
      const y = yOf(d.equity);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Fill under line
    ctx.lineTo(xOf(data.length - 1), pad.top + chartH);
    ctx.lineTo(pad.left, pad.top + chartH);
    ctx.closePath();
    ctx.fillStyle = gradient;
    ctx.fill();

    // X-axis labels (quarterly)
    const step = Math.max(1, Math.floor(data.length / 6));
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px monospace";
    ctx.textAlign = "center";
    for (let i = 0; i < data.length; i += step) {
      ctx.fillText(data[i].date.slice(0, 7), xOf(i), h - 8);
    }
  }, [data]);

  return (
    <GlassCard noPadding>
      <div className="p-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
        <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
          EQUITY CURVE
        </p>
      </div>
      <div className="p-2" style={{ height: 200 }}>
        <canvas ref={canvasRef} className="w-full h-full" />
      </div>
    </GlassCard>
  );
}
