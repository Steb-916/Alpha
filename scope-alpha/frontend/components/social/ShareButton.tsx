"use client";

/**
 * Share button — three actions:
 *   1. Copy link to clipboard (primary)
 *   2. Open Twitter intent in a new tab
 *   3. Native share (navigator.share) on mobile
 *
 * Renders a small dropdown of options. Falls back gracefully on browsers
 * that lack clipboard / share APIs.
 */

import { useEffect, useRef, useState } from "react";

interface Props {
  signalId: string;
  asset?: string;
  direction?: "long" | "short" | string;
  analystName?: string;
}

function getOrigin(): string {
  if (typeof window !== "undefined") return window.location.origin;
  return "";
}

export function ShareButton({ signalId, asset, direction, analystName }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const url = `${getOrigin()}/signal/${signalId}`;
  const tweetText = asset && direction && analystName
    ? `${direction === "long" ? "🟢" : "🔴"} ${asset} ${direction.toUpperCase()} signal from ${analystName} on Scope Alpha`
    : `Signal on Scope Alpha`;

  const handleCopy = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard not available */
    }
  };

  const handleTwitter = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
      tweetText,
    )}&url=${encodeURIComponent(url)}`;
    window.open(intent, "_blank", "noopener,noreferrer");
    setOpen(false);
  };

  const handleNativeShare = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({ title: tweetText, text: tweetText, url });
    } catch {
      /* user cancelled */
    }
    setOpen(false);
  };

  const hasNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-[10px] font-body cursor-pointer"
        style={{ color: "var(--text-muted)" }}
        title="Share"
      >
        ⤴ Share
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 z-50 rounded-[var(--radius-sm)] overflow-hidden min-w-[140px]"
          style={{
            background: "rgba(11, 14, 20, 0.97)",
            border: "1px solid var(--glass-border)",
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.4)",
          }}
        >
          <button
            type="button"
            onClick={handleCopy}
            className="block w-full text-left px-3 py-2 text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            {copied ? "✓ Copied!" : "📋 Copy link"}
          </button>
          <button
            type="button"
            onClick={handleTwitter}
            className="block w-full text-left px-3 py-2 text-[10px] font-body cursor-pointer"
            style={{
              color: "var(--text-secondary)",
              borderTop: "1px solid var(--glass-border)",
            }}
          >
            🐦 Share to Twitter / X
          </button>
          {hasNativeShare && (
            <button
              type="button"
              onClick={handleNativeShare}
              className="block w-full text-left px-3 py-2 text-[10px] font-body cursor-pointer"
              style={{
                color: "var(--text-secondary)",
                borderTop: "1px solid var(--glass-border)",
              }}
            >
              📱 Native share…
            </button>
          )}
        </div>
      )}
    </div>
  );
}
