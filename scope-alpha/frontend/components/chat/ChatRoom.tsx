"use client";

/**
 * ChatRoom — owns the per-room polling lifecycle and renders the message
 * list, typing indicator, banner, and input.
 *
 * Mounted by ChatDrawer when an active room is selected. The room handles:
 *   - openRoom on mount, closeRoom on unmount/room change
 *   - moderation state (banned → BannedState replacement, muted → MutedBanner)
 *   - read receipt updates on the latest message
 */

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";
import { useChatStore } from "@/lib/chatStore";
import { ChatMessage as ChatMessageComponent } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import { TypingIndicator } from "./TypingIndicator";
import { OnlineUsers } from "./OnlineUsers";
import { MutedBanner } from "./MutedBanner";
import { BannedState } from "./BannedState";

interface Props {
  roomId: string;
}

export function ChatRoom({ roomId }: Props) {
  const { data: session } = useSession();
  const messages = useChatStore((s) => s.messages[roomId] || []);
  const moderation = useChatStore((s) => s.moderation[roomId]);
  const presence = useChatStore((s) => s.presence[roomId]);
  const replyingTo = useChatStore((s) => s.replyingTo);
  const setReplyingTo = useChatStore((s) => s.setReplyingTo);
  const pinMessage = useChatStore((s) => s.pinMessage);
  const refreshRoom = useChatStore((s) => s.refreshRoom);
  const openRoom = useChatStore((s) => s.openRoom);
  const closeRoom = useChatStore((s) => s.closeRoom);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastReadIdRef = useRef<string | null>(null);

  const isOwner = session?.user?.id === roomId;
  const role = moderation?.role ?? "member";
  const isBanned = role === "banned";
  const isMuted = role === "muted";

  // Lifecycle: open the room on mount, close on unmount or roomId change.
  useEffect(() => {
    void openRoom(roomId);
    return () => {
      closeRoom(roomId);
    };
  }, [roomId, openRoom, closeRoom]);

  // Auto-scroll to bottom when new messages arrive.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Mark latest message as read (debounced — only when the most recent
  // message changes, not on every poll).
  useEffect(() => {
    if (!session?.user?.id) return;
    if (messages.length === 0) return;
    const latest = messages[messages.length - 1];
    if (latest.id === lastReadIdRef.current) return;
    if (latest.id.startsWith("temp-")) return; // skip optimistic
    lastReadIdRef.current = latest.id;
    void fetch(`/api/chat/${roomId}/read`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lastMessageId: latest.id }),
    }).catch(() => {});
  }, [messages, roomId, session?.user?.id]);

  // ── Banned: full replacement ─────────────────────────────────────────────
  if (isBanned) {
    return <BannedState />;
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <>
      {/* Online users header */}
      {presence && presence.online.length > 0 && (
        <div
          className="px-3 py-1.5 shrink-0"
          style={{ borderBottom: "1px solid rgba(255, 255, 255, 0.05)" }}
        >
          <OnlineUsers online={presence.online} />
        </div>
      )}

      {/* Message list */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {pinnedMessages.length > 0 && (
          <div
            className="mx-3 mb-2 p-2 rounded-[var(--radius-sm)]"
            style={{
              background: "rgba(245, 158, 11, 0.05)",
              border: "1px solid rgba(245, 158, 11, 0.15)",
            }}
          >
            <span
              className="text-[9px] font-body uppercase tracking-wider"
              style={{ color: "var(--accent-yellow)" }}
            >
              📌 Pinned
            </span>
            {pinnedMessages.map((m) => (
              <p
                key={m.id}
                className="text-[11px] font-body mt-0.5"
                style={{ color: "var(--text-secondary)" }}
              >
                <span style={{ color: "var(--text-primary)" }}>
                  {m.authorName}:
                </span>{" "}
                {m.content.slice(0, 100)}
              </p>
            ))}
          </div>
        )}

        {messages.length === 0 && (
          <p
            className="text-xs font-body text-center py-8"
            style={{ color: "var(--text-muted)" }}
          >
            No messages yet. Be the first to say hello.
          </p>
        )}

        {messages.map((msg) => (
          <ChatMessageComponent
            key={msg.id}
            msg={msg}
            isOwner={isOwner}
            isOwn={session?.user?.id === msg.authorId}
            roomId={roomId}
            onReply={setReplyingTo}
            onPin={pinMessage}
            onModerated={() => refreshRoom(roomId)}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Typing indicator */}
      {presence && <TypingIndicator typing={presence.typing} />}

      {/* Muted banner */}
      {isMuted && (
        <MutedBanner mutedUntil={moderation.mutedUntil} reason={null} />
      )}

      {/* Input (hidden when muted) */}
      <ChatInput
        roomId={roomId}
        muted={isMuted}
        replyingTo={replyingTo}
        onClearReply={() => setReplyingTo(null)}
      />
    </>
  );
}
