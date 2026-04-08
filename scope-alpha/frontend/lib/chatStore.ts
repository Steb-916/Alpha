/**
 * Chat store — Phase 6 rewrite.
 *
 * This used to be a fully client-side mock. Phase 6 wires it to the real
 * `/api/chat/[roomId]` API with 10-second polling per active room.
 *
 * The exported interface is intentionally kept identical to the previous
 * mock so the UI imports don't need to change. New methods are additive:
 * `openRoom`, `closeRoom`, `refreshRoom`, `loadOlder`, `pollPresence`.
 *
 * The mock `rooms` list (analyst directory) is preserved as a static label
 * source — the actual messages now come from the API per room.
 */

import { create } from "zustand";
import type {
  Announcement,
  ChatMessage,
  ChatRoom,
  ChatRoomModerationState,
  ChatPresenceData,
  ChatReadReceiptEntry,
} from "./chat";

const POLL_INTERVAL_MS = 10_000;

// Helper: convert a Prisma chat message row (as returned by the API) into
// the legacy `ChatMessage` shape the existing UI expects.
type ApiMessage = {
  id: string;
  roomId: string;
  authorId: string;
  authorName?: string | null;
  content: string;
  replyToId: string | null;
  replyToContent?: string | null;
  replyToAuthor?: string | null;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  messageType?: "message" | "announcement" | "system";
};

function normalizeApiMessage(m: ApiMessage): ChatMessage {
  const name = m.authorName || "Unknown";
  return {
    id: m.id,
    roomId: m.roomId,
    authorId: m.authorId,
    authorName: name,
    authorInitial: (name[0] ?? "?").toUpperCase(),
    content: m.content,
    replyToId: m.replyToId,
    replyToContent: m.replyToContent ?? null,
    replyToAuthor: m.replyToAuthor ?? null,
    isPinned: m.isPinned,
    isDeleted: m.isDeleted || m.deletedAt != null,
    createdAt: m.createdAt,
    mediaUrl: m.mediaUrl ?? null,
    mediaType: m.mediaType ?? null,
    deletedAt: m.deletedAt ?? null,
    deletedBy: m.deletedBy ?? null,
    messageType: m.messageType ?? "message",
  };
}

interface ApiResponse {
  messages: ApiMessage[];
  readReceipts?: ChatReadReceiptEntry[];
  moderation?: ChatRoomModerationState;
}

interface ChatState {
  // Existing UI state (preserved)
  isOpen: boolean;
  activeRoom: string | null;
  activeTab: "chat" | "announcements";
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  announcements: Record<string, Announcement[]>;
  replyingTo: ChatMessage | null;

  // Phase 6 additions
  loading: Record<string, boolean>;
  errors: Record<string, string | null>;
  oldestCursor: Record<string, string | null>;
  hasMore: Record<string, boolean>;
  readReceipts: Record<string, ChatReadReceiptEntry[]>;
  moderation: Record<string, ChatRoomModerationState>;
  presence: Record<string, ChatPresenceData>;
  pollTimers: Record<string, ReturnType<typeof setInterval>>;
  presenceTimers: Record<string, ReturnType<typeof setInterval>>;

  // Existing actions (preserved signatures)
  toggleDrawer: () => void;
  setActiveRoom: (roomId: string) => void;
  setActiveTab: (tab: "chat" | "announcements") => void;
  sendMessage: (
    content: string,
    opts?: { mediaUrl?: string; mediaType?: string },
  ) => Promise<void>;
  setReplyingTo: (msg: ChatMessage | null) => void;
  pinMessage: (msgId: string) => void;
  deleteMessage: (msgId: string) => void;
  createAnnouncement: (title: string, content: string) => void;
  markRoomRead: (roomId: string) => void;
  getTotalUnread: () => number;

  // Phase 6 actions
  openRoom: (roomId: string) => Promise<void>;
  closeRoom: (roomId: string) => void;
  refreshRoom: (roomId: string) => Promise<void>;
  loadOlder: (roomId: string) => Promise<void>;
  pollPresence: (roomId: string) => Promise<void>;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  activeRoom: null,
  activeTab: "chat",
  // Static "directory" of analyst rooms — labels only. Actual message data
  // comes from the API per room via openRoom().
  rooms: [
    {
      analystId: "crypto-rex",
      analystName: "CryptoRex",
      analystInitial: "C",
      unreadCount: 0,
    },
    {
      analystId: "degen-sensei",
      analystName: "DegenSensei",
      analystInitial: "D",
      unreadCount: 0,
    },
  ],
  messages: {},
  announcements: {},
  replyingTo: null,

  loading: {},
  errors: {},
  oldestCursor: {},
  hasMore: {},
  readReceipts: {},
  moderation: {},
  presence: {},
  pollTimers: {},
  presenceTimers: {},

  toggleDrawer: () =>
    set((state) => {
      const opening = !state.isOpen;
      const nextActive =
        opening && !state.activeRoom && state.rooms.length > 0
          ? state.rooms[0].analystId
          : state.activeRoom;
      if (opening && nextActive) {
        // Fire-and-forget — openRoom is async but toggle shouldn't block.
        void get().openRoom(nextActive);
      }
      return { isOpen: opening, activeRoom: nextActive };
    }),

  setActiveRoom: (roomId) => {
    const prev = get().activeRoom;
    if (prev && prev !== roomId) {
      get().closeRoom(prev);
    }
    set({ activeRoom: roomId, replyingTo: null });
    void get().openRoom(roomId);
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  sendMessage: async (content, opts) => {
    const roomId = get().activeRoom;
    if (!roomId || !content.trim()) return;

    const replyingTo = get().replyingTo;

    // Optimistic append.
    const tempId = `temp-${Date.now()}`;
    const tempMsg: ChatMessage = {
      id: tempId,
      roomId,
      authorId: "you",
      authorName: "You",
      authorInitial: "Y",
      content,
      replyToId: replyingTo?.id ?? null,
      replyToContent: replyingTo?.content.slice(0, 80) ?? null,
      replyToAuthor: replyingTo?.authorName ?? null,
      isPinned: false,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      mediaUrl: opts?.mediaUrl ?? null,
      mediaType: opts?.mediaType ?? null,
      messageType: "message",
    };

    set((state) => ({
      messages: {
        ...state.messages,
        [roomId]: [...(state.messages[roomId] || []), tempMsg],
      },
      replyingTo: null,
    }));

    try {
      const res = await fetch(`/api/chat/${roomId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          replyToId: replyingTo?.id,
          mediaUrl: opts?.mediaUrl,
          mediaType: opts?.mediaType,
        }),
      });
      if (!res.ok) {
        // Roll back optimistic message.
        set((state) => ({
          messages: {
            ...state.messages,
            [roomId]: (state.messages[roomId] || []).filter(
              (m) => m.id !== tempId,
            ),
          },
          errors: {
            ...state.errors,
            [roomId]: `Failed to send: HTTP ${res.status}`,
          },
        }));
        return;
      }
      // Refetch to get the real server-assigned ID + any side-effect rows.
      await get().refreshRoom(roomId);
    } catch (err) {
      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: (state.messages[roomId] || []).filter(
            (m) => m.id !== tempId,
          ),
        },
        errors: {
          ...state.errors,
          [roomId]: (err as Error).message || "Send failed",
        },
      }));
    }
  },

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  // Pin/delete are LOCAL-ONLY for backward compat with the legacy demo flow.
  // Phase 6 moderation goes through ModerationMenu → /api/chat/[roomId]/moderate.
  pinMessage: (msgId) =>
    set((state) => {
      const room = state.activeRoom;
      if (!room) return state;
      return {
        messages: {
          ...state.messages,
          [room]: (state.messages[room] || []).map((m) =>
            m.id === msgId ? { ...m, isPinned: !m.isPinned } : m,
          ),
        },
      };
    }),

  deleteMessage: (msgId) =>
    set((state) => {
      const room = state.activeRoom;
      if (!room) return state;
      return {
        messages: {
          ...state.messages,
          [room]: (state.messages[room] || []).map((m) =>
            m.id === msgId ? { ...m, isDeleted: true, content: "[deleted]" } : m,
          ),
        },
      };
    }),

  createAnnouncement: (title, content) =>
    set((state) => {
      const room = state.activeRoom;
      if (!room) return state;
      const roomData = state.rooms.find((r) => r.analystId === room);
      const newAnn: Announcement = {
        id: `ann-${room}-${Date.now()}`,
        analystId: room,
        analystName: roomData?.analystName || "Analyst",
        title,
        content,
        isPinned: false,
        createdAt: new Date().toISOString(),
      };
      return {
        announcements: {
          ...state.announcements,
          [room]: [newAnn, ...(state.announcements[room] || [])],
        },
      };
    }),

  markRoomRead: (roomId) =>
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.analystId === roomId ? { ...r, unreadCount: 0 } : r,
      ),
    })),

  getTotalUnread: () => get().rooms.reduce((sum, r) => sum + r.unreadCount, 0),

  // ─── Phase 6 backend sync actions ─────────────────────────────────────────

  openRoom: async (roomId) => {
    if (get().pollTimers[roomId]) {
      // Already polling — just refresh.
      await get().refreshRoom(roomId);
      return;
    }

    await get().refreshRoom(roomId);

    const messageTimer = setInterval(() => {
      void get().refreshRoom(roomId);
    }, POLL_INTERVAL_MS);

    const presenceTimer = setInterval(() => {
      void get().pollPresence(roomId);
    }, POLL_INTERVAL_MS);

    // Send heartbeat once on open and start the presence cycle.
    void get().pollPresence(roomId);

    set((state) => ({
      pollTimers: { ...state.pollTimers, [roomId]: messageTimer },
      presenceTimers: { ...state.presenceTimers, [roomId]: presenceTimer },
    }));
  },

  closeRoom: (roomId) => {
    const state = get();
    const messageTimer = state.pollTimers[roomId];
    const presenceTimer = state.presenceTimers[roomId];
    if (messageTimer) clearInterval(messageTimer);
    if (presenceTimer) clearInterval(presenceTimer);
    set((s) => {
      const nextPoll = { ...s.pollTimers };
      const nextPresence = { ...s.presenceTimers };
      delete nextPoll[roomId];
      delete nextPresence[roomId];
      return { pollTimers: nextPoll, presenceTimers: nextPresence };
    });
  },

  refreshRoom: async (roomId) => {
    set((state) => ({
      loading: { ...state.loading, [roomId]: true },
    }));
    try {
      const res = await fetch(`/api/chat/${roomId}?limit=50`);
      if (res.status === 403) {
        const data = await res.json().catch(() => ({}));
        set((state) => ({
          moderation: {
            ...state.moderation,
            [roomId]: {
              role: "banned",
              mutedUntil: null,
              bannedAt: new Date().toISOString(),
            },
          },
          errors: {
            ...state.errors,
            [roomId]: data.error || "You are banned from this room",
          },
          loading: { ...state.loading, [roomId]: false },
        }));
        return;
      }
      if (!res.ok) {
        set((state) => ({
          errors: {
            ...state.errors,
            [roomId]: `HTTP ${res.status}`,
          },
          loading: { ...state.loading, [roomId]: false },
        }));
        return;
      }

      const body = await res.json();
      // Two possible shapes — legacy array, Phase 6 envelope.
      const api: ApiResponse = Array.isArray(body)
        ? { messages: body, readReceipts: [], moderation: undefined }
        : body;

      const normalized = api.messages.map(normalizeApiMessage);

      set((state) => ({
        messages: { ...state.messages, [roomId]: normalized },
        oldestCursor: {
          ...state.oldestCursor,
          [roomId]: normalized[0]?.createdAt ?? null,
        },
        hasMore: { ...state.hasMore, [roomId]: normalized.length >= 50 },
        readReceipts: {
          ...state.readReceipts,
          [roomId]: api.readReceipts ?? [],
        },
        moderation: api.moderation
          ? { ...state.moderation, [roomId]: api.moderation }
          : state.moderation,
        errors: { ...state.errors, [roomId]: null },
        loading: { ...state.loading, [roomId]: false },
      }));
    } catch (err) {
      set((state) => ({
        errors: {
          ...state.errors,
          [roomId]: (err as Error).message || "Fetch failed",
        },
        loading: { ...state.loading, [roomId]: false },
      }));
    }
  },

  loadOlder: async (roomId) => {
    const cursor = get().oldestCursor[roomId];
    if (!cursor) return;
    try {
      const res = await fetch(
        `/api/chat/${roomId}?limit=50&before=${encodeURIComponent(cursor)}`,
      );
      if (!res.ok) return;
      const body = await res.json();
      const olderArray: ApiMessage[] = Array.isArray(body)
        ? body
        : body.messages ?? [];
      const older = olderArray.map(normalizeApiMessage);
      set((state) => ({
        messages: {
          ...state.messages,
          [roomId]: [...older, ...(state.messages[roomId] || [])],
        },
        oldestCursor: {
          ...state.oldestCursor,
          [roomId]: older[0]?.createdAt ?? state.oldestCursor[roomId],
        },
        hasMore: { ...state.hasMore, [roomId]: older.length >= 50 },
      }));
    } catch {
      /* ignore */
    }
  },

  pollPresence: async (roomId) => {
    try {
      // Heartbeat keeps us in the online set.
      void fetch(`/api/chat/${roomId}/heartbeat`, { method: "POST" }).catch(
        () => {},
      );

      const res = await fetch(`/api/chat/${roomId}/presence`);
      if (!res.ok) return;
      const data = (await res.json()) as ChatPresenceData;
      set((state) => ({
        presence: { ...state.presence, [roomId]: data },
      }));
    } catch {
      /* ignore */
    }
  },
}));
