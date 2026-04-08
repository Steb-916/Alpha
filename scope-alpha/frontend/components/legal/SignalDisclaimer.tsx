/**
 * Phase 7: signal disclaimer component.
 *
 * Rendered below every signal view (cards, detail page). The exact text
 * lives in lib/legal/disclaimer.ts so server-only code can import it
 * without crossing the "use client" boundary.
 *
 * The disclaimer is NOT optional or dismissible.
 */

import { SIGNAL_DISCLAIMER_TEXT } from "@/lib/legal/disclaimer";

export { SIGNAL_DISCLAIMER_TEXT };

interface Props {
  variant?: "inline" | "block";
}

export function SignalDisclaimer({ variant = "inline" }: Props) {
  if (variant === "block") {
    return (
      <div
        className="text-[10px] font-body leading-relaxed mt-3 p-2 rounded-[var(--radius-sm)]"
        style={{
          color: "var(--text-tertiary)",
          background: "rgba(255, 255, 255, 0.02)",
          border: "1px solid var(--glass-border)",
        }}
      >
        {SIGNAL_DISCLAIMER_TEXT}
      </div>
    );
  }
  return (
    <p
      className="text-[9px] font-body mt-2 leading-snug"
      style={{ color: "var(--text-tertiary)" }}
    >
      {SIGNAL_DISCLAIMER_TEXT}
    </p>
  );
}
