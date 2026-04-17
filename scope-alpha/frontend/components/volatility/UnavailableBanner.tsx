"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { Activity } from "lucide-react";

interface UnavailableBannerProps {
  quantEngineConfigured: boolean;
  tool: string;
}

/**
 * Shown by compute-dependent vol analytics tabs when the Quant Engine is
 * inert (QUANT_ENGINE_URL unset) or the cache is cold.
 */
export function UnavailableBanner({
  quantEngineConfigured,
  tool,
}: UnavailableBannerProps) {
  return (
    <div className="h-full flex items-center justify-center p-8">
      <GlassCard className="max-w-lg text-center">
        <div className="flex justify-center mb-4">
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{
              background: "rgba(148, 163, 184, 0.1)",
              border: "1px solid var(--glass-border)",
            }}
          >
            <Activity
              size={22}
              strokeWidth={1.5}
              style={{ color: "var(--text-muted)" }}
            />
          </div>
        </div>
        <div
          className="text-sm font-bold font-display mb-2"
          style={{ color: "var(--text-primary)" }}
        >
          {tool} not available
        </div>
        <p
          className="text-xs font-body leading-relaxed mb-3"
          style={{ color: "var(--text-secondary)" }}
        >
          {quantEngineConfigured
            ? "The options data refresh has not yet populated this cache. Trigger the refresh-options cron or wait up to an hour."
            : "This analytic requires the Quant Engine (Python FastAPI microservice). Set QUANT_ENGINE_URL and QUANT_ENGINE_API_KEY in your environment to enable it."}
        </p>
        <div
          className="inline-block px-2.5 py-1 rounded-[var(--radius-pill)] text-[10px] font-mono uppercase tracking-wider"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: "var(--text-muted)",
          }}
        >
          Inert mode
        </div>
      </GlassCard>
    </div>
  );
}
