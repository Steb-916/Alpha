"use client";

/**
 * Three-dot moderation menu for individual chat messages.
 * Only renders when the viewer is the room owner.
 *
 * Actions:
 *   - Delete message
 *   - Mute user (1h, 24h, permanent)
 *   - Ban user
 */

import { useEffect, useRef, useState } from "react";
import type { ChatMessage } from "@/lib/chat";

interface Props {
  roomId: string;
  message: ChatMessage;
  onComplete: () => void;
}

export function ModerationMenu({ roomId, message, onComplete }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const moderate = async (
    action: "delete_message" | "mute" | "ban",
    duration?: number,
  ) => {
    setBusy(true);
    try {
      await fetch(`/api/chat/${roomId}/moderate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          messageId: action === "delete_message" ? message.id : undefined,
          targetUserId:
            action === "mute" || action === "ban" ? message.authorId : undefined,
          duration: action === "mute" ? duration : undefined,
        }),
      });
      onComplete();
    } finally {
      setBusy(false);
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
        style={{ color: "var(--text-muted)" }}
        title="Moderate"
      >
        ⋯
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
            disabled={busy}
            onClick={() => moderate("delete_message")}
            className="block w-full text-left px-3 py-2 text-[10px] font-body cursor-pointer"
            style={{ color: "var(--accent-red)" }}
          >
            Delete message
          </button>
          <div
            className="px-3 py-1 text-[9px] font-body uppercase tracking-wider"
            style={{
              color: "var(--text-tertiary)",
              borderTop: "1px solid var(--glass-border)",
            }}
          >
            Mute {message.authorName}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => moderate("mute", 1)}
            className="block w-full text-left px-3 py-1.5 text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            For 1 hour
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => moderate("mute", 24)}
            className="block w-full text-left px-3 py-1.5 text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            For 24 hours
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => moderate("mute")}
            className="block w-full text-left px-3 py-1.5 text-[10px] font-body cursor-pointer"
            style={{ color: "var(--text-secondary)" }}
          >
            Permanently
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => moderate("ban")}
            className="block w-full text-left px-3 py-2 text-[10px] font-body cursor-pointer"
            style={{
              color: "var(--accent-red)",
              borderTop: "1px solid var(--glass-border)",
            }}
          >
            Ban {message.authorName}
          </button>
        </div>
      )}
    </div>
  );
}
