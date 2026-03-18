"use client";

import { useState, useRef, useEffect } from "react";
import { useChatStore } from "@/lib/chatStore";
import { GlassButton } from "@/components/ui/GlassButton";
import type { ChatMessage } from "@/lib/chat";

function MessageBubble({
  msg,
  isAnalyst,
  onReply,
  onPin,
  onDelete,
}: {
  msg: ChatMessage;
  isAnalyst: boolean;
  onReply: (msg: ChatMessage) => void;
  onPin: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const isOwn = msg.authorId === "current-user";
  const [showActions, setShowActions] = useState(false);

  return (
    <div
      className="group px-3 py-1.5 hover:bg-white/[0.02] relative"
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Pinned indicator */}
      {msg.isPinned && (
        <div className="text-[9px] font-body mb-0.5" style={{ color: "var(--accent-yellow)" }}>
          📌 Pinned
        </div>
      )}

      {/* Reply context */}
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
        {/* Avatar */}
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
            <span className="text-[9px] font-mono" style={{ color: "var(--text-tertiary)" }}>
              {new Date(msg.createdAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          <p
            className="text-xs font-body leading-relaxed break-words"
            style={{
              color: msg.isDeleted ? "var(--text-tertiary)" : "var(--text-secondary)",
              fontStyle: msg.isDeleted ? "italic" : "normal",
            }}
          >
            {msg.content}
          </p>
        </div>
      </div>

      {/* Actions */}
      {showActions && !msg.isDeleted && (
        <div
          className="absolute right-2 top-1 flex gap-1 px-1 py-0.5 rounded"
          style={{
            background: "var(--bg-secondary)",
            border: "1px solid var(--glass-border)",
          }}
        >
          <button
            onClick={() => onReply(msg)}
            className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
            style={{ color: "var(--text-muted)" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-green)")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
            title="Reply"
          >
            ↩
          </button>
          {isAnalyst && (
            <>
              <button
                onClick={() => onPin(msg.id)}
                className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style={{ color: msg.isPinned ? "var(--accent-yellow)" : "var(--text-muted)" }}
                title={msg.isPinned ? "Unpin" : "Pin"}
              >
                📌
              </button>
              <button
                onClick={() => onDelete(msg.id)}
                className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style={{ color: "var(--text-muted)" }}
                onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent-red)")}
                onMouseLeave={(e) => (e.currentTarget.style.color = "var(--text-muted)")}
                title="Delete"
              >
                ×
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AnnouncementCard({ ann }: { ann: { id: string; title: string; content: string; isPinned: boolean; createdAt: string } }) {
  return (
    <div
      className="mx-3 mb-2 p-3 rounded-[var(--radius-sm)]"
      style={{
        background: "rgba(0, 212, 170, 0.03)",
        border: "1px solid rgba(0, 212, 170, 0.15)",
      }}
    >
      {ann.isPinned && (
        <span className="text-[9px] font-body" style={{ color: "var(--accent-yellow)" }}>
          📌 Pinned
        </span>
      )}
      <h4 className="text-xs font-bold font-body" style={{ color: "var(--text-primary)" }}>
        {ann.title}
      </h4>
      <p className="text-[11px] font-body mt-1 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {ann.content}
      </p>
      <span className="text-[9px] font-mono mt-1 block" style={{ color: "var(--text-tertiary)" }}>
        {new Date(ann.createdAt).toLocaleDateString()}{" "}
        {new Date(ann.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      </span>
    </div>
  );
}

export function ChatDrawer() {
  const {
    isOpen,
    activeRoom,
    activeTab,
    rooms,
    messages,
    announcements,
    replyingTo,
    toggleDrawer,
    setActiveRoom,
    setActiveTab,
    sendMessage,
    setReplyingTo,
    pinMessage,
    deleteMessage,
    markRoomRead,
  } = useChatStore();

  const [input, setInput] = useState("");
  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { createAnnouncement } = useChatStore();

  const roomMessages = activeRoom ? messages[activeRoom] || [] : [];
  const roomAnnouncements = activeRoom ? announcements[activeRoom] || [] : [];
  const pinnedMessages = roomMessages.filter((m) => m.isPinned);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [roomMessages.length]);

  useEffect(() => {
    if (activeRoom) markRoomRead(activeRoom);
  }, [activeRoom, markRoomRead]);

  const handleSend = () => {
    if (input.trim()) {
      sendMessage(input.trim());
      setInput("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (!isOpen) return null;

  const inputStyle = {
    background: "rgba(15, 18, 26, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "var(--text-primary)",
  };

  return (
    <>
      {/* Backdrop overlay — dims terminal, click to close */}
      <div
        className="fixed inset-0 z-[59]"
        style={{ background: "rgba(0, 0, 0, 0.4)" }}
        onClick={toggleDrawer}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 bottom-0 w-[360px] z-[60] flex flex-col"
        style={{
          background: "rgba(11, 14, 20, 0.97)",
          backdropFilter: "blur(20px) saturate(150%)",
          borderLeft: "1px solid rgba(255, 255, 255, 0.08)",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.5)",
        }}
      >
      {/* Header */}
      <div
        className="px-3 py-2.5 flex items-center justify-between shrink-0"
        style={{
          background: "rgba(11, 14, 20, 0.98)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <h3 className="text-sm font-bold font-display" style={{ color: "var(--text-primary)" }}>
          Chat
        </h3>
        <button
          onClick={toggleDrawer}
          className="text-sm cursor-pointer"
          style={{ color: "var(--text-muted)" }}
        >
          ✕
        </button>
      </div>

      {/* Room tabs */}
      <div
        className="flex shrink-0 overflow-x-auto"
        style={{
          background: "rgba(13, 16, 23, 0.98)",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        {rooms.map((room) => (
          <button
            key={room.analystId}
            onClick={() => setActiveRoom(room.analystId)}
            className="px-3 py-2 text-xs font-body whitespace-nowrap cursor-pointer relative"
            style={{
              color: activeRoom === room.analystId ? "var(--accent-green)" : "var(--text-muted)",
              borderBottom: activeRoom === room.analystId ? "2px solid var(--accent-green)" : "2px solid transparent",
            }}
          >
            {room.analystName}
            {room.unreadCount > 0 && (
              <span
                className="ml-1 inline-block w-4 h-4 rounded-full text-[9px] font-bold leading-4 text-center"
                style={{ background: "var(--accent-red)", color: "white" }}
              >
                {room.unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Chat / Announcements toggle */}
      <div className="flex shrink-0 px-3 pt-2 gap-1">
        {(["chat", "announcements"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="px-3 py-1.5 rounded-[var(--radius-sm)] text-[10px] font-body uppercase tracking-wider cursor-pointer"
            style={{
              background: activeTab === tab ? "rgba(0, 212, 170, 0.1)" : "transparent",
              color: activeTab === tab ? "var(--accent-green)" : "var(--text-muted)",
              border: `1px solid ${activeTab === tab ? "rgba(0, 212, 170, 0.2)" : "transparent"}`,
            }}
          >
            {tab === "chat" ? "💬 Chat" : "📢 Announcements"}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-y-auto py-2">
        {activeTab === "chat" ? (
          <>
            {/* Pinned messages */}
            {pinnedMessages.length > 0 && (
              <div
                className="mx-3 mb-2 p-2 rounded-[var(--radius-sm)]"
                style={{
                  background: "rgba(245, 158, 11, 0.05)",
                  border: "1px solid rgba(245, 158, 11, 0.15)",
                }}
              >
                <span className="text-[9px] font-body uppercase tracking-wider" style={{ color: "var(--accent-yellow)" }}>
                  📌 Pinned
                </span>
                {pinnedMessages.map((m) => (
                  <p key={m.id} className="text-[11px] font-body mt-0.5" style={{ color: "var(--text-secondary)" }}>
                    <span style={{ color: "var(--text-primary)" }}>{m.authorName}:</span> {m.content.slice(0, 100)}
                  </p>
                ))}
              </div>
            )}

            {/* Messages */}
            {roomMessages.map((msg) => (
              <MessageBubble
                key={msg.id}
                msg={msg}
                isAnalyst={true}
                onReply={setReplyingTo}
                onPin={pinMessage}
                onDelete={deleteMessage}
              />
            ))}
            <div ref={messagesEndRef} />
          </>
        ) : (
          <>
            {/* Announcement create form */}
            {showAnnForm && (
              <div className="mx-3 mb-3 p-3 rounded-[var(--radius-sm)]" style={{ background: "var(--glass-bg)", border: "1px solid var(--glass-border)" }}>
                <input
                  value={annTitle}
                  onChange={(e) => setAnnTitle(e.target.value)}
                  placeholder="Announcement title..."
                  className="w-full px-2 py-1.5 rounded text-xs font-body outline-none mb-2"
                  style={inputStyle}
                />
                <textarea
                  value={annContent}
                  onChange={(e) => setAnnContent(e.target.value)}
                  placeholder="Write your announcement..."
                  rows={3}
                  className="w-full px-2 py-1.5 rounded text-xs font-body outline-none resize-none mb-2"
                  style={inputStyle}
                />
                <div className="flex gap-2">
                  <GlassButton variant="primary" size="sm" onClick={() => {
                    if (annTitle.trim() && annContent.trim()) {
                      createAnnouncement(annTitle.trim(), annContent.trim());
                      setAnnTitle("");
                      setAnnContent("");
                      setShowAnnForm(false);
                    }
                  }}>
                    Publish
                  </GlassButton>
                  <GlassButton variant="ghost" size="sm" onClick={() => setShowAnnForm(false)}>
                    Cancel
                  </GlassButton>
                </div>
              </div>
            )}

            {!showAnnForm && (
              <div className="mx-3 mb-2">
                <GlassButton variant="ghost" size="sm" onClick={() => setShowAnnForm(true)}>
                  + New Announcement
                </GlassButton>
              </div>
            )}

            {/* Announcements list */}
            {roomAnnouncements.map((ann) => (
              <AnnouncementCard key={ann.id} ann={ann} />
            ))}

            {roomAnnouncements.length === 0 && (
              <p className="text-xs font-body text-center py-8" style={{ color: "var(--text-muted)" }}>
                No announcements yet.
              </p>
            )}
          </>
        )}
      </div>

      {/* Input area (chat tab only) */}
      {activeTab === "chat" && (
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
                Replying to <span style={{ color: "var(--accent-green)" }}>{replyingTo.authorName}</span>
              </span>
              <button
                onClick={() => setReplyingTo(null)}
                className="cursor-pointer"
                style={{ color: "var(--text-muted)" }}
              >
                ✕
              </button>
            </div>
          )}

          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
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
                background: input.trim() ? "var(--accent-green)" : "var(--glass-bg)",
                color: input.trim() ? "var(--bg-primary)" : "var(--text-muted)",
                border: "1px solid var(--glass-border)",
              }}
            >
              ↑
            </button>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
