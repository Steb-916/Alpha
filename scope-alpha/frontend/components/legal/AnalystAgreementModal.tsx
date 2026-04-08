"use client";

/**
 * Phase 7: Analyst Publishing Agreement gate.
 *
 * Mounted on terminal pages where the analyst can publish signals. Detects
 * when an analyst tries to publish without having accepted the agreement
 * (server returns 403 with code='AGREEMENT_REQUIRED', or session.user
 * has analystAgreementAcceptedAt === null) and renders a modal.
 *
 * Designed to be mounted globally for analysts; only renders when:
 *   - role === 'analyst'
 *   - analystAgreementAcceptedAt is null
 *   - the `open` prop is true (set by the parent on first publish attempt)
 *
 * For the simplest integration the modal is also self-mounting based on a
 * window event 'analyst-agreement-required' that route handlers can dispatch
 * via `window.dispatchEvent(new CustomEvent('analyst-agreement-required'))`
 * after seeing a 403 with code='AGREEMENT_REQUIRED'.
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/ui/GlassCard";
import { MarkdownRenderer } from "@/components/legal/MarkdownRenderer";

const AGREEMENT_PREVIEW = `# Analyst Publishing Agreement

By publishing signals on Scope Alpha, you agree to:

- Signals are timestamped and immutable. You may not edit the price levels, direction, or timing of a published signal.
- You will not engage in front-running, wash trading, or any market manipulation.
- You are responsible for the accuracy of your performance claims.
- You grant Scope Alpha a non-exclusive license to display and distribute your signals.
- Scope Alpha may suspend or terminate your analyst account for violations.
- You are solely responsible for any tax obligations on income earned through the platform.
- Signal publication does not create a fiduciary relationship with subscribers.

The full agreement is available at /legal/analyst-agreement.`;

export function AnalystAgreementModal() {
  const { data: session, status, update } = useSession();
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Listen for the 403 → open event from any signal-publish call.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("analyst-agreement-required", handler);
    return () =>
      window.removeEventListener("analyst-agreement-required", handler);
  }, []);

  if (
    status !== "authenticated" ||
    session?.user?.role !== "analyst" ||
    session?.user?.analystAgreementAcceptedAt
  ) {
    return null;
  }

  if (!open) return null;

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/accept-analyst-agreement", {
        method: "POST",
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await update();
      setOpen(false);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-6"
      style={{ background: "rgba(0, 0, 0, 0.7)", backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-2xl w-full max-h-[85vh] overflow-y-auto">
        <GlassCard>
          <MarkdownRenderer content={AGREEMENT_PREVIEW} />

          <label
            className="flex items-center gap-2 mt-4 cursor-pointer text-sm font-body"
            style={{ color: "var(--text-secondary)" }}
          >
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) => setChecked(e.target.checked)}
              className="cursor-pointer"
            />
            I have read and agree to the Analyst Publishing Agreement.
          </label>

          {error && (
            <p
              className="text-xs font-body mt-3"
              style={{ color: "var(--accent-red)" }}
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-3 py-2 text-xs font-bold cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: "transparent",
                color: "var(--text-muted)",
                border: "1px solid var(--glass-border)",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={!checked || submitting}
              onClick={handleAccept}
              className="px-4 py-2 text-xs font-bold cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: "var(--accent-green)",
                color: "#fff",
                opacity: !checked || submitting ? 0.5 : 1,
                cursor: !checked || submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting ? "Accepting…" : "Accept and Continue"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
