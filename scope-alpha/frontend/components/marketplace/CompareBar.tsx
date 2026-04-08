"use client";

/**
 * Sticky bottom bar for the comparison flow.
 *
 * Appears when ≥1 analyst is selected. Click the action button to navigate
 * to the comparison page (requires ≥2 selected).
 */

import Link from "next/link";

interface Props {
  slugs: string[];
  onClear: () => void;
}

export function CompareBar({ slugs, onClear }: Props) {
  if (slugs.length === 0) return null;

  const canCompare = slugs.length >= 2;
  const href = `/marketplace/compare?ids=${slugs.join(",")}`;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 px-6 py-3 flex items-center justify-between"
      style={{
        background: "rgba(11, 14, 20, 0.97)",
        backdropFilter: "blur(20px)",
        borderTop: "1px solid var(--glass-border)",
        boxShadow: "0 -8px 32px rgba(0, 0, 0, 0.4)",
      }}
    >
      <div className="flex items-center gap-3">
        <span
          className="text-xs font-mono font-bold"
          style={{ color: "var(--text-primary)" }}
        >
          Compare ({slugs.length}/3)
        </span>
        <span className="text-[10px] font-body" style={{ color: "var(--text-muted)" }}>
          {slugs.join(" · ")}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onClear}
          className="text-[10px] font-body cursor-pointer px-3 py-1.5 rounded-[var(--radius-sm)]"
          style={{
            color: "var(--text-muted)",
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
          }}
        >
          Clear
        </button>
        {canCompare ? (
          <Link
            href={href}
            className="px-4 py-1.5 text-xs font-bold rounded-[var(--radius-sm)] no-underline"
            style={{ background: "var(--accent-green)", color: "#fff" }}
          >
            Compare →
          </Link>
        ) : (
          <span
            className="px-4 py-1.5 text-xs font-bold rounded-[var(--radius-sm)] opacity-50"
            style={{
              background: "var(--glass-bg)",
              color: "var(--text-muted)",
              border: "1px solid var(--glass-border)",
            }}
          >
            Pick 2–3 to compare
          </span>
        )}
      </div>
    </div>
  );
}
