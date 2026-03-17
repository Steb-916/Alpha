"use client";
import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";

const SHORTCUTS = [
  { key: "1", label: "Dashboard", path: "/terminal" },
  { key: "2", label: "Funding", path: "/terminal/funding" },
  { key: "3", label: "Open Interest", path: "/terminal/oi" },
  { key: "4", label: "Liquidations", path: "/terminal/liquidations" },
  { key: "5", label: "Basis", path: "/terminal/basis" },
  { key: "6", label: "Screener", path: "/terminal/screener" },
  { key: "?", label: "Show shortcuts", path: "" },
  { key: "Esc", label: "Close overlay", path: "" },
];

export function KeyboardShortcuts() {
  const [showOverlay, setShowOverlay] = useState(false);
  const router = useRouter();

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      if (e.key === "?") {
        e.preventDefault();
        setShowOverlay((v) => !v);
        return;
      }

      if (e.key === "Escape") {
        setShowOverlay(false);
        return;
      }

      const idx = parseInt(e.key);
      if (idx >= 1 && idx <= 6) {
        const shortcut = SHORTCUTS[idx - 1];
        if (shortcut) router.push(shortcut.path);
      }
    },
    [router]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  if (!showOverlay) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={() => setShowOverlay(false)}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative rounded-2xl p-8 max-w-md w-full mx-4"
        style={{
          background: "linear-gradient(145deg, #131620, #0F1219)",
          border: "1px solid rgba(255,255,255,0.08)",
          boxShadow: "0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(0,212,170,0.05)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-display font-bold text-text-primary mb-1">Keyboard Shortcuts</h2>
        <p className="text-xs text-text-muted font-mono mb-6">Press ? to toggle this overlay</p>

        <div className="space-y-2">
          {SHORTCUTS.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-white/[0.03]">
              <span className="text-sm text-text-secondary">{s.label}</span>
              <kbd className="px-2.5 py-1 rounded-md bg-white/[0.06] border border-white/[0.08] text-xs font-mono text-accent-green font-semibold">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-white/[0.05] text-center">
          <span className="text-[10px] text-text-dim font-mono">Press ESC or click outside to close</span>
        </div>
      </div>
    </div>
  );
}
