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
      style={{
        animation: "glassReveal 0.3s cubic-bezier(0.16, 1, 0.3, 1) both",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{
          background: "rgba(0, 0, 0, 0.3)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
        }}
      />

      {/* Modal Card */}
      <div
        className="relative glass p-8 max-w-md w-full mx-4"
        style={{
          borderRadius: "var(--radius-xl)",
          background: "var(--surface-modal)",
          animation: "glassReveal 0.4s cubic-bezier(0.16, 1, 0.3, 1) both",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative z-10">
          <h2 className="text-lg font-display font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Keyboard Shortcuts
          </h2>
          <p className="text-xs font-mono mb-6" style={{ color: "var(--text-muted)" }}>
            Press ? to toggle this overlay
          </p>

          <div className="space-y-2">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between py-2 px-3 rounded-[var(--radius-sm)]"
                style={{ transition: "background 0.2s ease" }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "var(--glass-bg)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
              >
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{s.label}</span>
                <kbd
                  className="px-2.5 py-1 text-xs font-mono font-semibold"
                  style={{
                    background: "var(--glass-bg)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "var(--radius-sm)",
                    color: "var(--accent-green)",
                    boxShadow: "inset 0 -2px 0 rgba(0,0,0,0.1), var(--glass-shadow)",
                  }}
                >
                  {s.key}
                </kbd>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 text-center" style={{ borderTop: "1px solid var(--glass-border)" }}>
            <span className="text-[10px] font-mono" style={{ color: "var(--text-muted)" }}>
              Press ESC or click outside to close
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
