"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useFearGreed } from "@/hooks/useFearGreed";
import { useSectorSentiment } from "@/hooks/useSectorSentiment";
import { FearGreedGauge } from "./FearGreedGauge";
import { FearGreedHistoryChart } from "./FearGreedHistoryChart";
import { SectorSentimentBar } from "./SectorSentimentBar";

export function SentimentView() {
  const fg = useFearGreed();
  const sector = useSectorSentiment();

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Fear & Greed Gauge */}
        <GlassCard>
          <div
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Fear &amp; Greed Index
          </div>

          {fg.isLoading ? (
            <div
              className="text-xs font-mono animate-pulse"
              style={{ color: "var(--text-muted)" }}
            >
              Loading…
            </div>
          ) : fg.unavailable || !fg.data ? (
            <div
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Fear &amp; Greed data unavailable
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <FearGreedGauge current={fg.data.current} />
              <div>
                <div
                  className="text-[10px] font-mono mb-2"
                  style={{ color: "var(--text-muted)" }}
                >
                  30-day history
                </div>
                <FearGreedHistoryChart history={fg.data.history} />
              </div>
              <div
                className="text-[10px] font-mono"
                style={{ color: "var(--text-muted)" }}
              >
                Source: Alternative.me · Updated daily
              </div>
            </div>
          )}
        </GlassCard>

        {/* Sector Sentiment */}
        <GlassCard>
          <div
            className="text-xs font-bold tracking-widest uppercase mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Sector Sentiment
          </div>
          <div
            className="text-[10px] font-mono mb-4"
            style={{ color: "var(--text-muted)" }}
          >
            Derived from perpetual funding rates
          </div>

          {sector.isLoading ? (
            <div
              className="text-xs font-mono animate-pulse"
              style={{ color: "var(--text-muted)" }}
            >
              Loading…
            </div>
          ) : sector.unavailable || !sector.data ? (
            <div
              className="text-xs font-mono"
              style={{ color: "var(--text-muted)" }}
            >
              Sector data unavailable
            </div>
          ) : (
            <SectorSentimentBar sectors={sector.data.sectors} />
          )}
        </GlassCard>
      </div>
    </div>
  );
}
