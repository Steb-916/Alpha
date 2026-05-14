"use client";

import { useEffect, useRef } from "react";
import type { ETFFlowPoint } from "@/types/macro";

interface Props {
  flows: ETFFlowPoint[];
}

function fmtM(v: number): string {
  if (Math.abs(v) >= 1_000_000_000)
    return `$${(v / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(0)}M`;
  return `$${v.toFixed(0)}`;
}

export function ETFFlowChart({ flows }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || flows.length === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = canvas.offsetHeight;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.scale(dpr, dpr);

    const recent = flows.slice(-60); // last 60 days
    const n = recent.length;
    const padL = 52;
    const padR = 16;
    const padT = 12;
    const padB = 28;
    const chartW = W - padL - padR;
    const chartH = H - padT - padB;

    const nets = recent.map((p) => p.net);
    const maxAbs = Math.max(1, ...nets.map(Math.abs));

    const barW = Math.max(2, chartW / n - 1);

    // Zero line
    const zeroY = padT + chartH / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padL, zeroY);
    ctx.lineTo(padL + chartW, zeroY);
    ctx.stroke();

    // Bars
    recent.forEach((p, i) => {
      const x = padL + (i / n) * chartW;
      const barH = Math.abs(p.net) / maxAbs * (chartH / 2 - 4);
      const y = p.net >= 0 ? zeroY - barH : zeroY;
      ctx.fillStyle = p.net >= 0
        ? "rgba(34,197,94,0.75)"
        : "rgba(239,68,68,0.75)";
      ctx.fillRect(x, y, barW, barH);
    });

    // Cumulative line
    const cumMax = Math.max(1, ...recent.map((p) => Math.abs(p.cumulative)));
    ctx.beginPath();
    ctx.strokeStyle = "rgba(168,85,247,0.8)";
    ctx.lineWidth = 1.5;
    recent.forEach((p, i) => {
      const x = padL + (i / n) * chartW + barW / 2;
      const y = padT + chartH * (1 - (p.cumulative + cumMax) / (2 * cumMax));
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Y labels
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    ctx.fillText(fmtM(maxAbs), padL - 4, padT + 10);
    ctx.fillText(fmtM(-maxAbs), padL - 4, padT + chartH - 2);
    ctx.fillText("0", padL - 4, zeroY + 3);

    // X labels
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.25)";
    const fmt = (d: string) => d.slice(5); // MM-DD
    ctx.fillText(fmt(recent[0].date), padL, H - 4);
    const last = fmt(recent[n - 1].date);
    ctx.textAlign = "right";
    ctx.fillText(last, padL + chartW, H - 4);
  }, [flows]);

  if (flows.length === 0) {
    return (
      <div
        className="text-xs font-mono text-center py-8"
        style={{ color: "var(--text-muted)" }}
      >
        ETF flow data unavailable
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <canvas ref={canvasRef} className="w-full" style={{ height: 160 }} />
      <div className="flex gap-4 text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-1" />
          Inflow
        </span>
        <span>
          <span className="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />
          Outflow
        </span>
        <span>
          <span className="inline-block w-3 h-0.5 bg-purple-400 mr-1 align-middle" />
          Cumulative
        </span>
      </div>
    </div>
  );
}
