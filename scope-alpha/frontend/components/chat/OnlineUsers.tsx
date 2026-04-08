"use client";

/**
 * Compact online users display for the chat room header.
 *
 * Shows up to 5 avatar initials with a green dot, plus an "X online" count.
 */

import type { ChatPresenceUser } from "@/lib/chat";

interface Props {
  online: ChatPresenceUser[];
}

export function OnlineUsers({ online }: Props) {
  if (online.length === 0) return null;
  const visible = online.slice(0, 5);

  return (
    <div className="flex items-center gap-1.5">
      <div className="flex items-center -space-x-1.5">
        {visible.map((u) => (
          <div
            key={u.userId}
            className="relative w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold"
            style={{
              background: "rgba(0, 212, 170, 0.15)",
              color: "var(--accent-green)",
              border: "1.5px solid rgba(11, 14, 20, 0.97)",
            }}
            title={u.displayName}
          >
            {(u.displayName[0] ?? "?").toUpperCase()}
            <span
              className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full"
              style={{
                background: "#10B981",
                border: "1px solid rgba(11, 14, 20, 0.97)",
              }}
            />
          </div>
        ))}
      </div>
      <span className="text-[9px] font-mono" style={{ color: "var(--text-muted)" }}>
        {online.length} online
      </span>
    </div>
  );
}
