"use client";

import { useEffect, useState } from "react";
import { ComputeAnimation } from "./ComputeAnimation";

const STAGE_DISPLAY_MS = 800;

interface ComputeLoaderProps {
  stages: readonly string[];
  /** Defaults to Running — parents can pass a label describing the work. */
  title?: string;
}

export function ComputeLoader({ stages, title }: ComputeLoaderProps) {
  const [currentStage, setCurrentStage] = useState(0);

  useEffect(() => {
    if (currentStage >= stages.length - 1) return;
    const timer = setTimeout(() => {
      setCurrentStage((prev) => Math.min(prev + 1, stages.length - 1));
    }, STAGE_DISPLAY_MS);
    return () => clearTimeout(timer);
  }, [currentStage, stages.length]);

  return (
    <div
      className="h-full flex flex-col items-center justify-center gap-8 py-8"
      style={{ minHeight: 400 }}
    >
      <ComputeAnimation
        currentStage={currentStage}
        totalStages={stages.length}
      />
      <div
        className="flex flex-col gap-1.5 w-full max-w-md"
        aria-live="polite"
        role="status"
      >
        {title && (
          <div
            className="text-[10px] font-mono uppercase tracking-widest mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            {title}
          </div>
        )}
        {stages.map((stage, i) => {
          const state =
            i < currentStage ? "done" : i === currentStage ? "active" : "pending";
          const color =
            state === "done"
              ? "var(--accent-green)"
              : state === "active"
                ? "var(--accent-green)"
                : "var(--text-muted)";
          const opacity = state === "done" ? 0.55 : state === "active" ? 1 : 0.35;
          const marker =
            state === "done" ? "✓" : state === "active" ? "▸" : "○";
          return (
            <div
              key={i}
              className="flex items-center gap-2 text-xs font-mono transition-all duration-500"
              style={{ color, opacity }}
            >
              <span className="w-3 inline-block text-center">{marker}</span>
              <span>{stage}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Delay-gated loader: the animation only renders if the parent has been
 * loading for >500ms. Cache hits (fast returns) skip the animation
 * entirely so they feel instant.
 */
export function useDelayedLoadingSignal(isLoading: boolean, delayMs = 500) {
  const [showLoader, setShowLoader] = useState(false);
  useEffect(() => {
    if (!isLoading) {
      setShowLoader(false);
      return;
    }
    const t = setTimeout(() => setShowLoader(true), delayMs);
    return () => clearTimeout(t);
  }, [isLoading, delayMs]);
  return showLoader;
}
