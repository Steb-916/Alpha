"use client";

import Link from "next/link";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AssetSelector } from "@/components/layout/AssetSelector";
import { TimeframeSelector } from "@/components/layout/TimeframeSelector";
import { AlertBell } from "@/components/layout/AlertBell";
import { UserMenu } from "@/components/layout/UserMenu";

interface TopBarProps {
  isGuest?: boolean;
}

export function TopBar({ isGuest = false }: TopBarProps) {
  return (
    <header
      className="h-12 flex items-center justify-between px-4 shrink-0 glass"
      style={{
        borderRadius: "var(--radius-lg)",
        background: "var(--surface-topbar)",
      }}
    >
      <div className="flex items-center gap-3 relative z-10">
        <AssetSelector />
        <TimeframeSelector />
      </div>

      <div className="flex items-center gap-2 relative z-10">
        <ThemeToggle />
        {isGuest ? (
          <>
            <Link
              href="/login"
              className="px-3 py-1.5 text-xs font-body rounded-[var(--radius-sm)]"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--glass-border)",
              }}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="px-3 py-1.5 text-xs font-bold font-body rounded-[var(--radius-sm)]"
              style={{ background: "var(--accent-green)", color: "#fff" }}
            >
              Sign up
            </Link>
          </>
        ) : (
          <>
            <AlertBell />
            <UserMenu />
          </>
        )}
      </div>
    </header>
  );
}
