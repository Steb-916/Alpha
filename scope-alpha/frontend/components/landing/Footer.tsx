"use client";

import Link from "next/link";

export function Footer() {
  return (
    <footer
      className="px-6 py-8 mt-8 flex flex-col md:flex-row items-center justify-between gap-4"
      style={{ borderTop: "1px solid var(--glass-border)" }}
    >
      <div
        className="text-xs font-mono"
        style={{ color: "var(--text-muted)" }}
      >
        © 2026 Scope Alpha
      </div>
      <div className="flex items-center gap-6">
        <Link
          href="/terms"
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Terms
        </Link>
        <Link
          href="/privacy"
          className="text-xs font-body"
          style={{ color: "var(--text-muted)" }}
        >
          Privacy
        </Link>
      </div>
    </footer>
  );
}
