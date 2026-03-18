"use client";
import { useTheme } from "@/lib/useTheme";
import { useHydrated } from "@/lib/useHydrated";

export function ThemeToggle() {
  const { resolvedTheme, toggle } = useTheme();
  const hydrated = useHydrated();

  if (!hydrated) {
    return (
      <button
        className="w-9 h-9 rounded-full glass flex items-center justify-center"
        aria-label="Toggle theme"
        style={{ overflow: "hidden" }}
      >
        <div className="w-4 h-4" />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      onClick={toggle}
      className="w-9 h-9 rounded-full glass flex items-center justify-center cursor-pointer hover:scale-105"
      aria-label={`Switch to ${isDark ? "light" : "dark"} mode`}
      style={{
        transition: "all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)",
      }}
    >
      <div className="relative w-5 h-5">
        {/* Sun icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 w-5 h-5"
          style={{
            color: "var(--text-primary)",
            opacity: isDark ? 0 : 1,
            transform: isDark ? "rotate(180deg) scale(0)" : "rotate(0deg) scale(1)",
            transition: "all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)",
          }}
        >
          <circle cx="12" cy="12" r="5" />
          <line x1="12" y1="1" x2="12" y2="3" />
          <line x1="12" y1="21" x2="12" y2="23" />
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
          <line x1="1" y1="12" x2="3" y2="12" />
          <line x1="21" y1="12" x2="23" y2="12" />
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
        </svg>

        {/* Moon icon */}
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="absolute inset-0 w-5 h-5"
          style={{
            color: "var(--text-primary)",
            opacity: isDark ? 1 : 0,
            transform: isDark ? "rotate(0deg) scale(1)" : "rotate(-90deg) scale(0)",
            transition: "all 0.5s cubic-bezier(0.34, 1.2, 0.64, 1)",
          }}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
      </div>
    </button>
  );
}
