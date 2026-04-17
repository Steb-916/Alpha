"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

export function UserMenu() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (!session?.user) {
    return (
      <Link
        href="/login"
        className="px-4 py-2 text-xs font-bold font-body rounded-[var(--radius-sm)] cursor-pointer"
        style={{
          border: "1px solid var(--glass-border)",
          color: "var(--text-secondary)",
          transition: "all 0.2s ease",
        }}
      >
        Sign In
      </Link>
    );
  }

  const label =
    session.user.displayName ||
    session.user.name ||
    session.user.email ||
    "U";

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer text-xs font-bold"
        style={{
          background: "linear-gradient(135deg, var(--accent-green), var(--accent-green-dim))",
          color: "#fff",
          border: "2px solid var(--glass-border)",
          transition: "all 0.2s ease",
        }}
      >
        {label.charAt(0).toUpperCase()}
      </button>
      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-48 py-1 rounded-[var(--radius-md)] z-50"
          style={{
            background: "var(--surface-modal, var(--glass-bg))",
            border: "1px solid var(--glass-border)",
            backdropFilter: "blur(20px)",
            boxShadow: "var(--glass-shadow-hover)",
          }}
        >
          <div
            className="px-3 py-2 text-xs font-body truncate"
            style={{
              color: "var(--text-tertiary)",
              borderBottom: "1px solid var(--glass-border)",
            }}
          >
            {label}
          </div>
          <Link
            href="/settings"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Settings
          </Link>
          <Link
            href="/settings/watchlists"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Watchlists
          </Link>
          <Link
            href="/settings/alerts"
            onClick={() => setOpen(false)}
            className="block px-3 py-2 text-sm font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--text-primary)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Alerts
          </Link>
          <button
            onClick={() => {
              setOpen(false);
              signOut({ callbackUrl: "/" });
            }}
            className="w-full text-left px-3 py-2 text-sm font-body cursor-pointer"
            style={{
              color: "var(--text-secondary)",
              borderTop: "1px solid var(--glass-border)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "var(--glass-bg)";
              e.currentTarget.style.color = "var(--accent-red)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "var(--text-secondary)";
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
