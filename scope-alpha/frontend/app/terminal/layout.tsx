"use client";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { KeyboardShortcuts } from "@/components/terminal/KeyboardShortcuts";

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg-primary">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-3">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>
      </div>
      <KeyboardShortcuts />
    </div>
  );
}
