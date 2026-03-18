"use client";

/**
 * Loading spinner using the Scope Alpha logo.
 * Shows a pulsing/rotating logo with optional loading text.
 */
export function LoadingSpinner({
  size = 48,
  text,
  fullPage = false,
}: {
  size?: number;
  text?: string;
  fullPage?: boolean;
}) {
  const spinner = (
    <div className="flex flex-col items-center justify-center gap-3">
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* Glow ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "2px solid transparent",
            borderTopColor: "var(--accent-green)",
            borderRightColor: "rgba(0, 212, 170, 0.3)",
            animation: "spin 1s linear infinite",
          }}
        />
        {/* Logo */}
        <div
          className="absolute inset-[6px] rounded-full overflow-hidden"
          style={{
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo-full.png"
            alt="Loading"
            style={{
              position: "absolute",
              width: "300%",
              maxWidth: "none",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              filter: "drop-shadow(0 0 8px var(--accent-green-glow))",
            }}
          />
        </div>
      </div>
      {text && (
        <span
          className="text-xs font-mono tracking-wider uppercase"
          style={{
            color: "var(--text-muted)",
            animation: "pulse 2s ease-in-out infinite",
          }}
        >
          {text}
        </span>
      )}
    </div>
  );

  if (fullPage) {
    return (
      <div
        className="fixed inset-0 z-[9999] flex items-center justify-center"
        style={{ background: "var(--bg-base)" }}
      >
        {spinner}
      </div>
    );
  }

  return spinner;
}

/**
 * Page-level loading state — centered in the content area.
 */
export function PageLoading({ text = "Loading" }: { text?: string }) {
  return (
    <div className="flex items-center justify-center w-full h-full min-h-[300px]">
      <LoadingSpinner size={56} text={text} />
    </div>
  );
}
