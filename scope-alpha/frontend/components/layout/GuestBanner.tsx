"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";

/**
 * Slim banner shown at the top of the terminal area when there's no session.
 * Encourages sign-up without blocking the experience.
 */
export function GuestBanner() {
  return (
    <div
      className="flex items-center justify-between px-4 py-2 shrink-0 glass"
      style={{
        borderRadius: "var(--radius-lg)",
        background: "rgba(0, 212, 170, 0.06)",
        border: "1px solid rgba(0, 212, 170, 0.25)",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles
          size={14}
          strokeWidth={1.75}
          style={{ color: "var(--accent-green)" }}
        />
        <span
          className="text-xs font-body"
          style={{ color: "var(--text-primary)" }}
        >
          Exploring as guest — data is live and real-time. Sign up to save
          watchlists and create alerts.
        </span>
      </div>
      <div className="flex items-center gap-2">
        <Link
          href="/login"
          className="px-3 py-1 text-xs font-body rounded-[var(--radius-sm)]"
          style={{
            color: "var(--text-secondary)",
            transition: "color 0.2s ease",
          }}
        >
          Log in
        </Link>
        <Link
          href="/signup"
          className="px-3 py-1 text-xs font-bold font-body rounded-[var(--radius-sm)]"
          style={{
            background: "var(--accent-green)",
            color: "#fff",
          }}
        >
          Create free account
        </Link>
      </div>
    </div>
  );
}
