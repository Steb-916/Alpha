"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { UnavailableBanner } from "@/components/volatility/UnavailableBanner";
import { useMacroCorrelations } from "@/hooks/useMacroCorrelations";
import { useETFFlows } from "@/hooks/useETFFlows";
import { useTokenUnlocks } from "@/hooks/useTokenUnlocks";
import { CorrelationHeatmap } from "./CorrelationHeatmap";
import { ETFFlowChart } from "./ETFFlowChart";
import { TokenUnlockTable } from "./TokenUnlockTable";

export function MacroView() {
  const corr = useMacroCorrelations();
  const etf = useETFFlows();
  const unlocks = useTokenUnlocks();

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Correlation Matrix */}
      <GlassCard>
        <div
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          BTC Macro Correlations
        </div>

        {corr.isLoading ? (
          <div
            className="text-xs font-mono animate-pulse"
            style={{ color: "var(--text-muted)" }}
          >
            Computing correlations…
          </div>
        ) : corr.unavailable || !corr.data || corr.data.matrix.length === 0 ? (
          <UnavailableBanner
            quantEngineConfigured={corr.quantEngineConfigured}
            tool="Macro Correlations"
          />
        ) : (
          <CorrelationHeatmap matrix={corr.data.matrix} />
        )}
      </GlassCard>

      {/* ETF Flows */}
      <GlassCard>
        <div
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          Bitcoin Spot ETF Flows
        </div>

        {etf.isLoading ? (
          <div
            className="text-xs font-mono animate-pulse"
            style={{ color: "var(--text-muted)" }}
          >
            Loading ETF flow data…
          </div>
        ) : (
          <ETFFlowChart flows={etf.data?.flows ?? []} />
        )}

        {etf.data && !etf.unavailable && (
          <div
            className="mt-2 text-[10px] font-mono"
            style={{ color: "var(--text-muted)" }}
          >
            Source: SoSoValue · IBIT, FBTC, ARKB, BITB aggregate
          </div>
        )}
      </GlassCard>

      {/* Token Unlock Calendar */}
      <GlassCard>
        <div
          className="text-xs font-bold tracking-widest uppercase mb-4"
          style={{ color: "var(--text-muted)" }}
        >
          Upcoming Token Unlocks
        </div>

        {unlocks.isLoading ? (
          <div
            className="text-xs font-mono animate-pulse"
            style={{ color: "var(--text-muted)" }}
          >
            Loading…
          </div>
        ) : (
          <TokenUnlockTable events={unlocks.data?.events ?? []} />
        )}

        <div
          className="mt-3 text-[10px] font-mono"
          style={{ color: "var(--text-muted)" }}
        >
          Hover rows for details · Amounts are estimates · Cliff = large single unlock
        </div>
      </GlassCard>
    </div>
  );
}
