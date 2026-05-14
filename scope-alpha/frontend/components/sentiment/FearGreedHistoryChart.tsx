"use client";

import { useEffect, useRef } from "react";
import type { FearGreedPoint } from "@/types/sentiment";

interface Props {
  history: FearGreedPoint[];
}

function fgColor(value: number): string {
  if (value <= 20) return "#ef4444";
  if (value <= 40) return "#f97316";
  if (value <= 60) return "#eab308";
  if (value <= 80) return "#22c55e";
  return "#16a34a";
}

export function FearGreedHistoryChart({ history }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const sorted = [...history].reverse(); // oldest → newest
    const padL = 32;
    const padR = 12;
    const padT = 12;
    const padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const n = sorted.length;

    // Grid lines at 20/40/60/80
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    [20, 40, 60, 80].forEach((v) => {
      const y = padT + chartH - (v / 100) * chartH;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + chartW, y);
      ctx.stroke();
      ctx.fillStyle = "rgba(255,255,255,0.3)";
      ctx.font = "9px monospace";
      ctx.fillText(String(v), 2, y + 3);
    });

    // Area fill + line
    const pts = sorted.map((p, i) => ({
      x: padL + (i / (n - 1)) * chartW,
      y: padT + chartH - (p.value / 100) * chartH,
      v: p.value,
    }));

    // Gradient fill
    const grad = ctx.createLinearGradient(0, padT, 0, padT + chartH);
    grad.addColorStop(0, "rgba(34,197,94,0.35)");
    grad.addColorStop(0.5, "rgba(234,179,8,0.2)");
    grad.addColorStop(1, "rgba(239,68,68,0.1)");

    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + chartH);
    pts.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(pts[pts.length - 1].x, padT + chartH);
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    // Line
    ctx.beginPath();
    pts.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Dots (every 7th)
    pts.forEach((p, i) => {
      if (i % 7 !== 0 && i !== pts.length - 1) return;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = fgColor(p.v);
      ctx.fill();
    });

    // X-axis date labels (first and last)
    ctx.fillStyle = "rgba(255,255,255,0.35)";
    ctx.font = "9px monospace";
    const fmt = (iso: string) => iso.slice(5, 10); // MM-DD
    ctx.fillText(fmt(sorted[0].timestamp), padL, H - 4);
    const lastLabel = fmt(sorted[n - 1].timestamp);
    const lw = ctx.measureText(lastLabel).width;
    ctx.fillText(lastLabel, padL + chartW - lw, H - 4);
  }, [history]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full"
      style={{ height: 120 }}
    />
  );
}
