"use client";

import { GlassCard } from "@/components/ui/GlassCard";
import { useOnChainOverview } from "@/hooks/useOnChain";
import { useRND } from "@/hooks/useRND";
import { useOptionsChain } from "@/hooks/useOptionsChain";

function fmtPct(v: number | null | undefined): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(1)}%`;
}

function fmtBig(v: number | null): string {
  if (v === null) return "—";
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
  return `$${v.toLocaleString()}`;
}

interface Props {
  asset: string;
}

export function RNDOnChainCompare({ asset }: Props) {
  const { data: onchain } = useOnChainOverview(asset);
  const { data: chain } = useOptionsChain(asset);

  // Use the nearest available expiry date (slice to YYYY-MM-DD for useRND)
  const nearestExpiry = chain?.expirations[0]?.expiration?.slice(0, 10) ?? null;

  const { data: rnd, unavailable: rndUnavailable } = useRND(asset, nearestExpiry);

  const hasRND = rnd && !rndUnavailable;
  const hasOnchain = onchain !== null;

  if (!hasOnchain && !hasRND) return null;

  const mvrvLabel = onchain?.mvrvSignal === "undervalued"
    ? "Structurally Undervalued"
    : onchain?.mvrvSignal === "overvalued"
    ? "Structurally Overvalued"
    : "Fair Value Zone";

  const mvrvColor = onchain?.mvrvSignal === "undervalued"
    ? "var(--accent-green)"
    : onchain?.mvrvSignal === "overvalued"
    ? "var(--data-red)"
    : "var(--data-yellow)";

  return (
    <GlassCard>
      <div className="text-[10px] font-mono uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
        Probabilistic vs Structural — {asset}
      </div>
      <div className="grid grid-cols-2 gap-4">
        {/* On-chain side */}
        <div>
          <div className="text-xs font-bold font-display mb-2" style={{ color: "var(--text-primary)" }}>
            On-Chain Perspective
          </div>
          <div className="flex flex-col gap-2">
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>MVRV Z-Score</div>
              <div className="text-sm font-bold font-mono" style={{ color: mvrvColor }}>
                {onchain?.mvrvZScore !== null ? onchain?.mvrvZScore?.toFixed(2) : "—"} — {mvrvLabel}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Realized Cap</div>
              <div className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                {fmtBig(onchain?.realizedCap ?? null)}
              </div>
              <div className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
                Aggregate cost basis of all coins
              </div>
            </div>
            <div>
              <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>SOPR</div>
              <div className="text-sm font-bold font-mono" style={{ color: "var(--text-secondary)" }}>
                {onchain?.sopr?.toFixed(3) ?? "—"}
              </div>
              <div className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
                {onchain?.soprSignal === "profit" ? "Coins moving in profit" :
                  onchain?.soprSignal === "loss" ? "Coins moving at a loss" : "Neutral"}
              </div>
            </div>
          </div>
        </div>

        {/* Options side */}
        <div>
          <div className="text-xs font-bold font-display mb-2" style={{ color: "var(--text-primary)" }}>
            Options (Probabilistic)
          </div>
          {!hasRND ? (
            <div className="text-[11px] font-body" style={{ color: "var(--text-muted)" }}>
              {rndUnavailable
                ? "Quant engine not configured — RND data unavailable"
                : nearestExpiry
                ? "Loading options data…"
                : "No options expiry data found"}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {nearestExpiry && (
                <div>
                  <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>Expiry</div>
                  <div className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                    {new Date(nearestExpiry).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                  </div>
                </div>
              )}
              <div>
                <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>RND Mean</div>
                <div className="text-sm font-bold font-mono" style={{ color: "var(--text-primary)" }}>
                  ${rnd.statistics.mean?.toLocaleString() ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>RND Skewness</div>
                <div className="text-sm font-bold font-mono" style={{
                  color: rnd.statistics.skewness > 0 ? "var(--accent-green)" : rnd.statistics.skewness < 0 ? "var(--data-red)" : "var(--text-secondary)",
                }}>
                  {rnd.statistics.skewness?.toFixed(2) ?? "—"}
                  {" "}({rnd.statistics.skewness > 0.3 ? "Upside skew" : rnd.statistics.skewness < -0.3 ? "Downside skew" : "Symmetric"})
                </div>
              </div>
              <div>
                <div className="text-[10px] font-mono mb-1" style={{ color: "var(--text-muted)" }}>
                  Tail Probabilities
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span style={{ color: "var(--text-muted)" }}>P(above spot)</span>
                  <span style={{ color: "var(--text-secondary)" }}>{fmtPct(rnd.statistics.prob_above_spot)}</span>
                </div>
                <div className="flex justify-between text-[10px] font-mono">
                  <span style={{ color: "var(--text-muted)" }}>P(below $80K)</span>
                  <span style={{ color: "var(--text-secondary)" }}>{fmtPct(rnd.statistics.prob_below_80k)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      <p className="text-[10px] font-mono mt-3" style={{ color: "var(--text-muted)" }}>
        On-chain shows structural cost basis and holder behavior. Options show probabilistic market expectations. Use both together.
      </p>
    </GlassCard>
  );
}
