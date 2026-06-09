"use client";

import { useState, useCallback } from "react";
import { Search, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { GlassCard } from "@/components/ui/GlassCard";
import { formatPrice } from "@/lib/utils";
import type { SimilarityMatch, SimilarityResponse } from "@/app/api/tools/similarity/route";

interface Props {
  asset: string;
}

function ForwardBadge({ value }: { value: number | null }) {
  if (value == null) return <span style={{ color: "var(--text-muted)" }}>—</span>;
  const color = value > 0 ? "var(--accent-green)" : value < 0 ? "var(--data-red)" : "var(--text-muted)";
  const Icon = value > 0 ? TrendingUp : value < 0 ? TrendingDown : Minus;
  return (
    <span className="inline-flex items-center gap-0.5 font-semibold" style={{ color }}>
      <Icon size={10} />
      {value > 0 ? "+" : ""}{value.toFixed(1)}%
    </span>
  );
}

function SimilarityBar({ pct }: { pct: number }) {
  const color = pct >= 80 ? "var(--accent-green)" : pct >= 60 ? "var(--accent-blue)" : "var(--text-muted)";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex-1 h-1 rounded-full" style={{ background: "var(--glass-bg-hover)" }}>
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.min(100, pct)}%`, background: color }}
        />
      </div>
      <span className="text-[10px] font-mono font-semibold" style={{ color }}>
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function ForwardDistribution({ matches }: { matches: SimilarityMatch[] }) {
  const fwd30 = matches.map((m) => m.fwd30d).filter((v): v is number => v != null);
  if (fwd30.length === 0) return null;

  const pos = fwd30.filter((v) => v > 0).length;
  const neg = fwd30.filter((v) => v < 0).length;
  const total = fwd30.length;
  const posPct = Math.round((pos / total) * 100);
  const negPct = Math.round((neg / total) * 100);

  const avg = fwd30.reduce((a, b) => a + b, 0) / total;
  const median = [...fwd30].sort((a, b) => a - b)[Math.floor(total / 2)];
  const max = Math.max(...fwd30);
  const min = Math.min(...fwd30);

  return (
    <GlassCard>
      <p className="text-[10px] uppercase tracking-wider font-mono font-semibold mb-3" style={{ color: "var(--text-muted)" }}>
        30-Day Forward Distribution ({total} matches)
      </p>

      {/* Outcome bar */}
      <div className="flex rounded-full overflow-hidden h-2 mb-3">
        <div style={{ width: `${posPct}%`, background: "var(--accent-green)" }} />
        <div style={{ width: `${negPct}%`, background: "var(--data-red)" }} />
      </div>
      <div className="flex justify-between text-[10px] font-mono mb-4">
        <span style={{ color: "var(--accent-green)" }}>↑ {posPct}% positive</span>
        <span style={{ color: "var(--data-red)" }}>{negPct}% negative ↓</span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Avg", value: avg },
          { label: "Median", value: median },
          { label: "Best", value: max },
          { label: "Worst", value: min },
        ].map(({ label, value }) => (
          <div key={label} className="text-center">
            <p className="text-[9px] font-mono mb-0.5" style={{ color: "var(--text-muted)" }}>{label}</p>
            <p
              className="text-xs font-mono font-semibold"
              style={{ color: value > 0 ? "var(--accent-green)" : value < 0 ? "var(--data-red)" : "var(--text-muted)" }}
            >
              {value > 0 ? "+" : ""}{value.toFixed(1)}%
            </p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

export function SimilarityPanel({ asset }: Props) {
  const [data, setData] = useState<SimilarityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tools/similarity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asset, topN: 10 }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `HTTP ${res.status}`);
      }
      setData(await res.json());
    } catch (e: unknown) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [asset]);

  return (
    <div className="space-y-3">
      {/* Header + trigger */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
            Historical Similarity
          </h2>
          <p className="text-[11px] font-mono mt-0.5" style={{ color: "var(--text-muted)" }}>
            Finds past {asset} market states most similar to today's conditions.
          </p>
        </div>
        <button
          onClick={run}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-sm)] text-xs font-mono font-semibold transition-all disabled:opacity-50"
          style={{ background: "var(--accent-blue)", color: "#000" }}
        >
          <Search size={12} />
          {loading ? "Searching…" : "Find Similar"}
        </button>
      </div>

      {error && (
        <div className="p-2 rounded text-xs font-mono" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--data-red)" }}>
          {error}
        </div>
      )}

      {!data && !loading && !error && (
        <GlassCard>
          <p className="text-sm font-mono text-center py-8" style={{ color: "var(--text-muted)" }}>
            Click "Find Similar" to search {asset} history for analogous market conditions.
          </p>
        </GlassCard>
      )}

      {loading && (
        <GlassCard>
          <p className="text-sm font-mono text-center py-8" style={{ color: "var(--text-muted)" }}>
            Searching historical snapshots…
          </p>
        </GlassCard>
      )}

      {data && !loading && (
        <>
          {/* Forward distribution summary */}
          <ForwardDistribution matches={data.matches} />

          {/* Match cards */}
          <GlassCard noPadding>
            <div className="p-3 border-b" style={{ borderColor: "var(--glass-border)" }}>
              <p className="text-xs font-mono font-semibold" style={{ color: "var(--text-muted)" }}>
                TOP MATCHES — {data.matches.length} similar periods
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px] font-mono">
                <thead className="sticky top-0" style={{ background: "var(--glass-bg-hover)" }}>
                  <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
                    {["Date", "Price", "Similarity", "Health", "Funding", "MVRV-Z", "7d Fwd", "14d Fwd", "30d Fwd"].map((h) => (
                      <th key={h} className="py-1.5 px-3 text-left text-[10px] uppercase tracking-wider whitespace-nowrap" style={{ color: "var(--text-muted)" }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((m, i) => (
                    <tr key={i} style={{ borderBottom: "1px solid var(--glass-border)" }} className="hover:bg-white/[0.02]">
                      <td className="py-1.5 px-3 whitespace-nowrap" style={{ color: "var(--text-secondary)" }}>{m.date}</td>
                      <td className="py-1.5 px-3 whitespace-nowrap" style={{ color: "var(--text-primary)" }}>{formatPrice(m.close)}</td>
                      <td className="py-1.5 px-3 min-w-[100px]">
                        <SimilarityBar pct={m.similarityPct} />
                      </td>
                      <td className="py-1.5 px-3" style={{ color: "var(--text-secondary)" }}>
                        {m.healthScore != null ? m.healthScore.toFixed(0) : "—"}
                      </td>
                      <td className="py-1.5 px-3" style={{ color: "var(--text-secondary)" }}>
                        {m.fundingRate != null ? `${(m.fundingRate * 100).toFixed(3)}%` : "—"}
                      </td>
                      <td className="py-1.5 px-3" style={{ color: "var(--text-secondary)" }}>
                        {m.mvrvZScore != null ? m.mvrvZScore.toFixed(2) : "—"}
                      </td>
                      <td className="py-1.5 px-3"><ForwardBadge value={m.fwd7d} /></td>
                      <td className="py-1.5 px-3"><ForwardBadge value={m.fwd14d} /></td>
                      <td className="py-1.5 px-3"><ForwardBadge value={m.fwd30d} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <p className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
            Similarity is computed via normalized Euclidean distance across healthScore, fundingRate, priceChange1d, MVRV Z-Score, SOPR, and IV30d. Forward returns are historical, not predictive. Not financial advice.
          </p>
        </>
      )}
    </div>
  );
}
