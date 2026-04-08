"use client";

/**
 * Marketplace comparison page.
 *
 * Reads `ids=slug1,slug2[,slug3]` from the URL, fetches the comparison data
 * via SWR, and renders the side-by-side grid.
 */

import { useSearchParams } from "next/navigation";
import Link from "next/link";
import useSWR from "swr";
import { Suspense } from "react";
import { AnalystComparison } from "@/components/marketplace/AnalystComparison";
import { GlassCard } from "@/components/ui/GlassCard";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

function CompareInner() {
  const params = useSearchParams();
  const idsParam = params.get("ids") ?? "";
  const ids = idsParam.split(",").filter(Boolean);

  const { data, error } = useSWR<{ analysts: Parameters<typeof AnalystComparison>[0]["analysts"] }>(
    ids.length >= 2 ? `/api/analysts/compare?ids=${ids.join(",")}` : null,
    fetcher,
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--bg-primary)" }}>
      <div
        className="sticky top-0 z-50 px-6 py-3 flex items-center gap-3"
        style={{
          background: "rgba(10, 14, 20, 0.85)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--glass-border)",
        }}
      >
        <Link
          href="/marketplace"
          className="text-sm font-body cursor-pointer no-underline"
          style={{ color: "var(--text-muted)" }}
        >
          ← Marketplace
        </Link>
        <span className="text-xs font-mono" style={{ color: "var(--text-tertiary)" }}>
          /marketplace/compare
        </span>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <h1
          className="text-2xl font-bold font-display mb-1"
          style={{ color: "var(--text-primary)" }}
        >
          Compare Analysts
        </h1>
        <p className="text-sm font-body mb-6" style={{ color: "var(--text-muted)" }}>
          Side-by-side metric comparison. Best values are highlighted in green.
        </p>

        {ids.length < 2 ? (
          <GlassCard>
            <div className="text-center py-8">
              <p className="text-sm font-body" style={{ color: "var(--text-muted)" }}>
                Pick 2 or 3 analysts in the marketplace to compare.
              </p>
              <Link
                href="/marketplace"
                className="inline-block mt-3 px-4 py-2 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
                style={{ background: "var(--accent-green)", color: "#fff" }}
              >
                Browse marketplace →
              </Link>
            </div>
          </GlassCard>
        ) : error ? (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--accent-red)" }}>
              Failed to load comparison data.
            </p>
          </GlassCard>
        ) : !data ? (
          <GlassCard>
            <p className="text-xs font-body" style={{ color: "var(--text-muted)" }}>
              Loading…
            </p>
          </GlassCard>
        ) : (
          <AnalystComparison analysts={data.analysts} />
        )}
      </div>
    </div>
  );
}

export default function ComparePage() {
  return (
    <Suspense
      fallback={
        <div className="p-6 text-xs font-body" style={{ color: "var(--text-muted)" }}>
          Loading…
        </div>
      }
    >
      <CompareInner />
    </Suspense>
  );
}
