"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ChatDrawer } from "@/components/chat/ChatDrawer";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/terminal/KeyboardShortcuts";
import { DemoBanner } from "@/components/terminal/DemoBanner";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: "transparent" }}>
      <DemoBanner />
      <div className="flex flex-1 min-h-0">
      {/* Sidebar — floating glass panel */}
      <div className="p-2 pr-0 z-20">
        <Sidebar />
      </div>

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-w-0 p-2 gap-2">
        <TopBar />
        <main className="flex-1 overflow-auto rounded-[var(--radius-lg)]">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>

      <ChatDrawer />
      <KeyboardShortcuts />
      </div>
    </div>
  );
}
