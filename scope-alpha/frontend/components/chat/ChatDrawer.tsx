"use client";

/**
 * ChatDrawer — thin shell that owns the open/close + active tab state and
 * mounts <ChatRoom /> for the currently selected room.
 *
 * Phase 6 split:
 *   - Message list / input / per-message actions → ChatRoom + ChatMessage + ChatInput
 *   - Announcement list → still rendered inline here (separate tab)
 *
 * The room directory tabs at the top + the chat/announcements tab toggle
 * stay in the drawer.
 */

import { useState, useEffect } from "react";
import { useChatStore } from "@/lib/chatStore";
import { GlassButton } from "@/components/ui/GlassButton";
import { ChatRoom } from "./ChatRoom";

function AnnouncementCard({
  ann,
}: {
  ann: {
    id: string;
    title: string;
    content: string;
    isPinned: boolean;
    createdAt: string;
  };
}) {
  return (
    <div
      className="mx-3 mb-2 p-3 rounded-[var(--radius-sm)]"
      style={{
        background: "rgba(0, 212, 170, 0.03)",
        border: "1px solid rgba(0, 212, 170, 0.15)",
      }}
    >
      {ann.isPinned && (
        <span
          className="text-[9px] font-body"
          style={{ color: "var(--accent-yellow)" }}
        >
          📌 Pinned
        </span>
      )}
      <h4
        className="text-xs font-bold font-body"
        style={{ color: "var(--text-primary)" }}
      >
        {ann.title}
      </h4>
      <p
        className="text-[11px] font-body mt-1 leading-relaxed"
        style={{ color: "var(--text-secondary)" }}
      >
        {ann.content}
      </p>
      <span
        className="text-[9px] font-mono mt-1 block"
        style={{ color: "var(--text-tertiary)" }}
      >
        {new Date(ann.createdAt).toLocaleDateString()}{" "}
        {new Date(ann.createdAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

export function ChatDrawer() {
  const isOpen = useChatStore((s) => s.isOpen);
  const activeRoom = useChatStore((s) => s.activeRoom);
  const activeTab = useChatStore((s) => s.activeTab);
  const rooms = useChatStore((s) => s.rooms);
  const announcements = useChatStore((s) => s.announcements);
  const toggleDrawer = useChatStore((s) => s.toggleDrawer);
  const setActiveRoom = useChatStore((s) => s.setActiveRoom);
  const setActiveTab = useChatStore((s) => s.setActiveTab);
  const createAnnouncement = useChatStore((s) => s.createAnnouncement);
  const markRoomRead = useChatStore((s) => s.markRoomRead);

  const [showAnnForm, setShowAnnForm] = useState(false);
  const [annTitle, setAnnTitle] = useState("");
  const [annContent, setAnnContent] = useState("");

  const roomAnnouncements = activeRoom ? announcements[activeRoom] || [] : [];

  // Mark the legacy unread-badge counter cleared when switching rooms.
  // (Phase 6 read receipts are tracked separately via /api/chat/[roomId]/read.)
  useEffect(() => {
    if (activeRoom) markRoomRead(activeRoom);
  }, [activeRoom, markRoomRead]);

  if (!isOpen) return null;

  const inputStyle = {
    background: "rgba(15, 18, 26, 0.8)",
    border: "1px solid rgba(255, 255, 255, 0.08)",
    color: "var(--text-primary)",
  };

  return (
    <>
      <div
        className="fixed inset-0 z-[59]"
        style={{ background: "rgba(0, 0, 0, 0.4)" }}
        onClick={toggleDrawer}
      />

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
          <h3
            className="text-sm font-bold font-display"
            style={{ color: "var(--text-primary)" }}
          >
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
                color:
                  activeRoom === room.analystId
                    ? "var(--accent-green)"
                    : "var(--text-muted)",
                borderBottom:
                  activeRoom === room.analystId
                    ? "2px solid var(--accent-green)"
                    : "2px solid transparent",
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
                background:
                  activeTab === tab
                    ? "rgba(0, 212, 170, 0.1)"
                    : "transparent",
                color:
                  activeTab === tab
                    ? "var(--accent-green)"
                    : "var(--text-muted)",
                border: `1px solid ${activeTab === tab ? "rgba(0, 212, 170, 0.2)" : "transparent"}`,
              }}
            >
              {tab === "chat" ? "💬 Chat" : "📢 Announcements"}
            </button>
          ))}
        </div>

        {/* Body */}
        {activeTab === "chat" ? (
          activeRoom ? (
            <ChatRoom roomId={activeRoom} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <p
                className="text-xs font-body"
                style={{ color: "var(--text-muted)" }}
              >
                Pick a room to start chatting.
              </p>
            </div>
          )
        ) : (
          <div className="flex-1 min-h-0 overflow-y-auto py-2">
            {showAnnForm && (
              <div
                className="mx-3 mb-3 p-3 rounded-[var(--radius-sm)]"
                style={{
                  background: "var(--glass-bg)",
                  border: "1px solid var(--glass-border)",
                }}
              >
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
                  <GlassButton
                    variant="primary"
                    size="sm"
                    onClick={() => {
                      if (annTitle.trim() && annContent.trim()) {
                        createAnnouncement(annTitle.trim(), annContent.trim());
                        setAnnTitle("");
                        setAnnContent("");
                        setShowAnnForm(false);
                      }
                    }}
                  >
                    Publish
                  </GlassButton>
                  <GlassButton
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowAnnForm(false)}
                  >
                    Cancel
                  </GlassButton>
                </div>
              </div>
            )}

            {!showAnnForm && (
              <div className="mx-3 mb-2">
                <GlassButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAnnForm(true)}
                >
                  + New Announcement
                </GlassButton>
              </div>
            )}

            {roomAnnouncements.map((ann) => (
              <AnnouncementCard key={ann.id} ann={ann} />
            ))}

            {roomAnnouncements.length === 0 && (
              <p
                className="text-xs font-body text-center py-8"
                style={{ color: "var(--text-muted)" }}
              >
                No announcements yet.
              </p>
            )}
          </div>
        )}
      </div>
    </>
  );
}
