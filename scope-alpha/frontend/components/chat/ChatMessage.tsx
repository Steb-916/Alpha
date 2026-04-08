"use client";

/**
 * Single chat message renderer.
 *
 * Renders four variants based on `messageType`:
 *   - 'message' (default) — text + optional media
 *   - 'announcement' — accented border + 📢 label, full-width
 *   - 'system' — gray centered text
 *   - deletedAt != null → "[Message deleted by analyst]" placeholder
 *
 * Hover-revealed actions row (Reply / Pin / ModerationMenu).
 */

import { useState } from "react";
import type { ChatMessage as ChatMessageType } from "@/lib/chat";
import { ChatMediaPreview } from "./ChatMediaPreview";
import { ModerationMenu } from "./ModerationMenu";

interface Props {
  msg: ChatMessageType;
  /** True when the current viewer is the analyst owning this room. */
  isOwner: boolean;
  /** True when this message is by the current viewer (for "own" styling). */
  isOwn: boolean;
  roomId: string;
  onReply: (msg: ChatMessageType) => void;
  onPin: (id: string) => void;
  /** Called after the moderation menu successfully deletes / mutes / bans. */
  onModerated: () => void;
}

export function ChatMessage({
  msg,
  isOwner,
  isOwn,
  roomId,
  onReply,
  onPin,
  onModerated,
}: Props) {
  const [showActions, setShowActions] = useState(false);

  const isDeleted = Boolean(msg.deletedAt) || msg.isDeleted;
  const isAnnouncement = msg.messageType === "announcement";
  const isSystem = msg.messageType === "system";

  // ─── System message ───────────────────────────────────────────────────────
  if (isSystem) {
    return (
      <div
        className="px-3 py-1 text-center text-[10px] font-mono"
        style={{ color: "var(--text-tertiary)" }}
      >
        {msg.content}
      </div>
    );
  }

  // ─── Announcement message ─────────────────────────────────────────────────
  if (isAnnouncement) {
    return (
      <div
        className="mx-3 my-2 p-3 rounded-[var(--radius-sm)]"
        style={{
          background: "rgba(0, 212, 170, 0.06)",
          border: "1px solid rgba(0, 212, 170, 0.3)",
          borderLeft: "4px solid var(--accent-green)",
        }}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-[9px] font-bold font-body uppercase tracking-wider"
            style={{ color: "var(--accent-green)" }}
          >
            📢 Announcement
          </span>
          <span
            className="text-[9px] font-mono ml-auto"
            style={{ color: "var(--text-tertiary)" }}
          >
            {new Date(msg.createdAt).toLocaleString([], {
              hour: "2-digit",
              minute: "2-digit",
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <p
          className="text-xs font-body whitespace-pre-line"
          style={{ color: "var(--text-secondary)" }}
        >
          {msg.content}
        </p>
        {msg.mediaUrl && msg.mediaType && (
          <ChatMediaPreview url={msg.mediaUrl} type={msg.mediaType} />
        )}
      </div>
    );
  }

  // ─── Regular message ──────────────────────────────────────────────────────
  return (
    <div
      className="group px-3 py-1.5 hover:bg-white/[0.02] relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {msg.isPinned && (
        <div
          className="text-[9px] font-body mb-0.5"
          style={{ color: "var(--accent-yellow)" }}
        >
          📌 Pinned
        </div>
      )}

      {msg.replyToId && msg.replyToContent && (
        <div
          className="text-[10px] font-body mb-1 pl-3 py-0.5 rounded"
          style={{
            borderLeft: "2px solid var(--accent-green)",
            color: "var(--text-muted)",
          }}
        >
          <span style={{ color: "var(--accent-green)" }}>{msg.replyToAuthor}</span>{" "}
          {msg.replyToContent}
        </div>
      )}

      <div className="flex gap-2">
        <div
          className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5"
          style={{
            background: isOwn
              ? "rgba(99, 102, 241, 0.2)"
              : "rgba(0, 212, 170, 0.15)",
            color: isOwn ? "#818CF8" : "var(--accent-green)",
            border: `1px solid ${isOwn ? "rgba(99, 102, 241, 0.3)" : "rgba(0, 212, 170, 0.25)"}`,
          }}
        >
          {msg.authorInitial}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span
              className="text-xs font-bold font-body"
              style={{ color: isOwn ? "#818CF8" : "var(--text-primary)" }}
            >
              {msg.authorName}
            </span>
            <span
              className="text-[9px] font-mono"
              style={{ color: "var(--text-tertiary)" }}
            >
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p
            className="text-xs font-body leading-relaxed break-words"
            style={{
              color: isDeleted
                ? "var(--text-tertiary)"
                : "var(--text-secondary)",
              fontStyle: isDeleted ? "italic" : "normal",
            }}
          >
            {isDeleted
              ? msg.deletedAt
                ? "[Message deleted by analyst]"
                : msg.content
              : msg.content}
          </p>
          {!isDeleted && msg.mediaUrl && msg.mediaType && (
            <ChatMediaPreview url={msg.mediaUrl} type={msg.mediaType} />
          )}
        </div>
      </div>

      {showActions && !isDeleted && (
        <div
          className="absolute right-2 top-1 flex gap-1 px-1 py-0.5 rounded"
          style={{
            background: "var(--bg-secondary, rgba(11, 14, 20, 0.95))",
            border: "1px solid var(--glass-border)",
          }}
        >
          <button
            onClick={() => onReply(msg)}
            className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--accent-green)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--text-muted)")
            }
            title="Reply"
          >
            ↩
          </button>
          {isOwner && (
            <>
              <button
                onClick={() => onPin(msg.id)}
                className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style={{
                  color: msg.isPinned
                    ? "var(--accent-yellow)"
                    : "var(--text-muted)",
                }}
                title={msg.isPinned ? "Unpin" : "Pin"}
              >
                📌
              </button>
              <ModerationMenu
                roomId={roomId}
                message={msg}
                onComplete={onModerated}
              />
            </>
          )}
        </div>
      )}
    </div>
  );
}
