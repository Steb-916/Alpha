"use client";

/**
 * Phase 7: Terms of Service acceptance gate.
 *
 * Mounted globally in the root layout. Renders a full-screen modal when the
 * authenticated user has not yet accepted the Terms (session.user.tosAcceptedAt
 * is null). Calling /api/users/accept-tos persists the acceptance, then we
 * trigger NextAuth's session `update()` to refresh the JWT.
 *
 * Demo accounts: the demo bypass flow creates the user without setting
 * tosAcceptedAt. The first time the demo user lands on a real page, this
 * modal appears. Clicking Accept dismisses it for the lifetime of the demo.
 */

import { useState } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";
import { GlassCard } from "@/components/ui/GlassCard";

export function TosAcceptanceModal() {
  const { data: session, status, update } = useSession();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status !== "authenticated" || !session?.user?.id) return null;
  if (session.user.tosAcceptedAt) return null;

  async function handleAccept() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/users/accept-tos", { method: "POST" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await update();
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
      <div className="max-w-lg w-full">
        <GlassCard>
          <h2
            className="text-lg font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
            Welcome to Scope Alpha
          </h2>
          <p
            className="text-sm font-body mt-3"
            style={{ color: "var(--text-secondary)" }}
          >
            Before continuing, please review and accept our{" "}
            <Link
              href="/terms"
              target="_blank"
              className="no-underline"
              style={{ color: "var(--accent-green)" }}
            >
              Terms of Service
            </Link>{" "}
            and{" "}
            <Link
              href="/privacy"
              target="_blank"
              className="no-underline"
              style={{ color: "var(--accent-green)" }}
            >
              Privacy Policy
            </Link>
            .
          </p>
          <p
            className="text-[11px] font-body mt-3"
            style={{ color: "var(--text-muted)" }}
          >
            Scope Alpha is a market analytics tool. Nothing on the platform
            constitutes financial advice. Trade at your own risk.
          </p>
          {error && (
            <p
              className="text-xs font-body mt-3"
              style={{ color: "var(--accent-red)" }}
            >
              {error}
            </p>
          )}
          <div className="flex justify-end mt-4">
            <button
              type="button"
              disabled={submitting}
              onClick={handleAccept}
              className="px-4 py-2 text-xs font-bold cursor-pointer rounded-[var(--radius-sm)]"
              style={{
                background: "var(--accent-green)",
                color: "#fff",
                opacity: submitting ? 0.5 : 1,
                cursor: submitting ? "wait" : "pointer",
              }}
            >
              {submitting ? "Accepting…" : "I Accept"}
            </button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
