"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { GuestBanner } from "@/components/layout/GuestBanner";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { ConnectionStatusIndicator } from "@/components/ui/ConnectionStatus";
import { TosAcceptanceModal } from "@/components/legal/TosAcceptanceModal";
import { useMarketData } from "@/hooks/useMarketData";

interface AppShellProps {
  children: React.ReactNode;
  /** Server-detected session absence. Passed in to avoid a flash-of-guest-UI
   *  on the initial SSR render before useSession() hydrates. */
  isGuest?: boolean;
}

export function AppShell({ children, isGuest = false }: AppShellProps) {
  const { isLiveEnabled } = useMarketData();

  return (
    <div
      className="flex flex-col h-screen overflow-hidden"
      style={{ background: "transparent" }}
    >
      <div className="flex flex-1 min-h-0">
        <div className="p-2 pr-0 z-20">
          <Sidebar isGuest={isGuest} />
        </div>

        <div className="flex-1 flex flex-col min-w-0 p-2 gap-2">
          <TopBar isGuest={isGuest} />
          {isGuest && <GuestBanner />}
          <main className="flex-1 overflow-auto rounded-[var(--radius-lg)]">
            <ErrorBoundary>{children}</ErrorBoundary>
          </main>
        </div>
      </div>

      {isLiveEnabled && <ConnectionStatusIndicator />}

      {!isGuest && <TosAcceptanceModal />}
    </div>
  );
}
