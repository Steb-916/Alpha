"use client";

/**
 * Chat input bar.
 *
 * - Text input + send button
 * - Reply preview (when replyingTo is set)
 * - Paperclip button for media upload (disabled when STORAGE_DISABLED)
 * - Debounced typing ping (every 3s while typing)
 * - Hidden when current user is muted/banned
 */

import { useEffect, useRef, useState } from "react";
import { useChatStore } from "@/lib/chatStore";
import type { ChatMessage } from "@/lib/chat";

interface Props {
  roomId: string;
  /** Pass true if the current user is muted in this room (banned hides the whole room). */
  muted?: boolean;
  replyingTo: ChatMessage | null;
  onClearReply: () => void;
}

const TYPING_PING_INTERVAL_MS = 3000;
const inputStyle: React.CSSProperties = {
  background: "rgba(15, 18, 26, 0.8)",
  border: "1px solid rgba(255, 255, 255, 0.08)",
  color: "var(--text-primary)",
};

export function ChatInput({ roomId, muted, replyingTo, onClearReply }: Props) {
  const sendMessage = useChatStore((s) => s.sendMessage);
  const [input, setInput] = useState("");
  const [pendingMedia, setPendingMedia] = useState<{
    url: string;
    type: string;
  } | null>(null);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [storageDisabled, setStorageDisabled] = useState(false);
  const [uploading, setUploading] = useState(false);
  const lastTypingPingRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset media when switching rooms.
  useEffect(() => {
    setPendingMedia(null);
    setMediaError(null);
  }, [roomId]);

  if (muted) {
    // The room renders <MutedBanner /> above; the input is hidden entirely.
    return null;
  }

  const sendTypingPing = () => {
    const now = Date.now();
    if (now - lastTypingPingRef.current < TYPING_PING_INTERVAL_MS) return;
    lastTypingPingRef.current = now;
    void fetch(`/api/chat/${roomId}/typing`, { method: "POST" }).catch(() => {});
  };

  const handleSend = async () => {
    if (!input.trim() && !pendingMedia) return;
    await sendMessage(
      input.trim(),
      pendingMedia
        ? { mediaUrl: pendingMedia.url, mediaType: pendingMedia.type }
        : undefined,
    );
    setInput("");
    setPendingMedia(null);
    onClearReply();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    } else {
      // Any other key counts as typing.
      sendTypingPing();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setMediaError(null);
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/chat/${roomId}/media`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data.code === "STORAGE_DISABLED") {
          setStorageDisabled(true);
          setMediaError("Media sharing is not configured");
          return;
        }
        setMediaError(data.error || `Upload failed (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      setPendingMedia({ url: data.url, type: data.type });
    } catch (err) {
      setMediaError((err as Error).message || "Upload failed");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div
      className="shrink-0 px-3 py-2"
      style={{
        background: "rgba(11, 14, 20, 0.98)",
        borderTop: "1px solid rgba(255, 255, 255, 0.08)",
      }}
    >
      {/* Reply preview */}
      {replyingTo && (
        <div
          className="flex items-center justify-between mb-1.5 px-2 py-1 rounded text-[10px]"
          style={{
            background: "rgba(0, 212, 170, 0.05)",
            borderLeft: "2px solid var(--accent-green)",
          }}
        >
          <span style={{ color: "var(--text-muted)" }}>
            Replying to{" "}
            <span style={{ color: "var(--accent-green)" }}>
              {replyingTo.authorName}
            </span>
          </span>
          <button
            onClick={onClearReply}
            className="cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Pending media preview */}
      {pendingMedia && (
        <div
          className="flex items-center gap-2 mb-1.5 px-2 py-1 rounded text-[10px]"
          style={{
            background: "rgba(0, 212, 170, 0.05)",
            border: "1px solid rgba(0, 212, 170, 0.2)",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={pendingMedia.url}
            alt="pending"
            className="w-8 h-8 rounded object-cover"
          />
          <span style={{ color: "var(--text-muted)" }}>Image attached</span>
          <button
            onClick={() => setPendingMedia(null)}
            className="ml-auto cursor-pointer"
            style={{ color: "var(--text-muted)" }}
          >
            ✕
          </button>
        </div>
      )}

      {mediaError && (
        <div
          className="mb-1.5 text-[10px] font-body"
          style={{ color: "var(--accent-red)" }}
        >
          {mediaError}
        </div>
      )}

      <div className="flex gap-2">
        {/* Paperclip button */}
        <button
          type="button"
          disabled={uploading || storageDisabled}
          onClick={() => fileInputRef.current?.click()}
          className="px-2 py-2 rounded-[var(--radius-sm)] text-xs cursor-pointer"
          style={{
            background: "var(--glass-bg)",
            border: "1px solid var(--glass-border)",
            color: storageDisabled ? "var(--text-tertiary)" : "var(--text-muted)",
            opacity: storageDisabled || uploading ? 0.5 : 1,
            cursor: storageDisabled ? "not-allowed" : "pointer",
          }}
          title={
            storageDisabled
              ? "Media sharing is not configured"
              : "Attach image"
          }
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={handleFileChange}
          className="hidden"
        />

        <input
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            sendTypingPing();
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          className="flex-1 px-2.5 py-2 rounded-[var(--radius-sm)] text-xs font-body outline-none"
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = "var(--accent-green)")}
          onBlur={(e) => (e.target.style.borderColor = "var(--glass-border)")}
        />
        <button
          onClick={handleSend}
          className="px-3 py-2 rounded-[var(--radius-sm)] text-xs font-bold cursor-pointer"
          style={{
            background:
              input.trim() || pendingMedia
                ? "var(--accent-green)"
                : "var(--glass-bg)",
            color:
              input.trim() || pendingMedia
                ? "var(--bg-primary)"
                : "var(--text-muted)",
            border: "1px solid var(--glass-border)",
          }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
