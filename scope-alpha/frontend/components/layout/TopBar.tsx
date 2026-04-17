"use client";

import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { AssetSelector } from "@/components/layout/AssetSelector";
import { TimeframeSelector } from "@/components/layout/TimeframeSelector";
import { AlertBell } from "@/components/layout/AlertBell";
import { UserMenu } from "@/components/layout/UserMenu";

export function TopBar() {
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
        <AlertBell />
        <UserMenu />
      </div>
    </header>
  );
}
