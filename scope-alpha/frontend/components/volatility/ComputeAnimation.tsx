"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Cinematic loading visual: an SVG canvas where a density curve is drawn
 * in stages — scattered dots → smooth spline → area fill → percentile
 * markers. Timed to feel like the real Breeden-Litzenberger pipeline.
 *
 * Respects prefers-reduced-motion — falls back to a subtle pulsing bar.
 */

interface ComputeAnimationProps {
  currentStage: number;
  totalStages: number;
}

const WIDTH = 480;
const HEIGHT = 200;
const N_DOTS = 22;

function curveY(x: number): number {
  // Gaussian-ish curve centered at WIDTH/2 with small put skew
  const mu = WIDTH * 0.52;
  const sigma = WIDTH * 0.18;
  const z = (x - mu) / sigma;
  const pdf = Math.exp(-0.5 * z * z);
  return HEIGHT - 24 - pdf * (HEIGHT - 48);
}

export function ComputeAnimation({
  currentStage,
  totalStages,
}: ComputeAnimationProps) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Stage progression (0..1)
  const progress = Math.min(1, (currentStage + 1) / Math.max(totalStages, 1));

  const dots = useRef<Array<{ x: number; y: number; seed: number }>>(
    Array.from({ length: N_DOTS }, (_, i) => ({
      x: 24 + ((i + 0.5) / N_DOTS) * (WIDTH - 48),
      y: 0,
      seed: Math.random(),
    })),
  );

  // Scattered jitter that relaxes to the curve as progress increases.
  const scatteredY = (x: number, seed: number): number => {
    const baseline = curveY(x);
    const jitter = (seed - 0.5) * (HEIGHT - 80);
    const t = Math.min(1, progress * 1.3);
    return baseline + jitter * (1 - t);
  };

  if (reduced) {
    return (
      <div
        className="w-full max-w-[480px] h-2 rounded-full overflow-hidden"
        style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progress * 100}%`,
            background: "var(--accent-green)",
          }}
        />
      </div>
    );
  }

  // Build the spline path (full curve) — opacity ramps with progress
  const pathPoints: string[] = [];
  for (let i = 0; i <= 60; i++) {
    const x = 24 + (i / 60) * (WIDTH - 48);
    const y = curveY(x);
    pathPoints.push(`${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  const splineD = pathPoints.join(" ");

  const splineOpacity = progress > 0.35 ? Math.min(1, (progress - 0.35) * 2) : 0;
  const fillOpacity = progress > 0.55 ? Math.min(0.4, (progress - 0.55) * 0.8) : 0;
  const markersOpacity = progress > 0.8 ? Math.min(1, (progress - 0.8) * 5) : 0;

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      width={WIDTH}
      height={HEIGHT}
      style={{ maxWidth: "100%", height: "auto" }}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="densityFill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--accent-green)" stopOpacity="0.6" />
          <stop offset="1" stopColor="var(--accent-green)" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Baseline axis */}
      <line
        x1={24}
        x2={WIDTH - 24}
        y1={HEIGHT - 24}
        y2={HEIGHT - 24}
        stroke="var(--glass-border)"
        strokeWidth={1}
      />

      {/* Scattered dots — always visible, relaxing onto the curve */}
      {dots.current.map((d, i) => (
        <circle
          key={i}
          cx={d.x}
          cy={scatteredY(d.x, d.seed)}
          r={2.4}
          fill="var(--accent-green)"
          opacity={Math.max(0.3, 0.85 - progress * 0.5)}
        >
          <animate
            attributeName="opacity"
            values="0.85;0.45;0.85"
            dur="1.8s"
            repeatCount="indefinite"
            begin={`${(d.seed * 1.5).toFixed(2)}s`}
          />
        </circle>
      ))}

      {/* Spline curve — draws in during stage 3 */}
      <path
        d={splineD}
        fill="none"
        stroke="var(--accent-green)"
        strokeWidth={1.8}
        opacity={splineOpacity}
        strokeDasharray={splineOpacity > 0 ? "none" : "4 6"}
      />

      {/* Density fill under curve — appears stage 4 */}
      <path
        d={`${splineD} L${WIDTH - 24},${HEIGHT - 24} L24,${HEIGHT - 24} Z`}
        fill="url(#densityFill)"
        opacity={fillOpacity}
      />

      {/* Percentile markers — stage 5 */}
      {markersOpacity > 0 &&
        [WIDTH * 0.25, WIDTH * 0.52, WIDTH * 0.78].map((x, i) => (
          <line
            key={i}
            x1={x}
            x2={x}
            y1={HEIGHT - 24}
            y2={curveY(x) - 4}
            stroke="var(--text-primary)"
            strokeWidth={1}
            strokeDasharray="2 2"
            opacity={markersOpacity}
          />
        ))}
    </svg>
  );
}
