import { create } from "zustand";
import type { ChatMessage, Announcement, ChatRoom } from "./chat";

// Mock data for demo
function generateMockMessages(roomId: string, analystName: string): ChatMessage[] {
  const msgs: ChatMessage[] = [];
  const now = Date.now();
  const users = [
    { id: "analyst-1", name: analystName, initial: analystName[0] },
    { id: "user-1", name: "TraderJoe", initial: "T" },
    { id: "user-2", name: "CryptoApe", initial: "C" },
    { id: "user-3", name: "DeFiDegen", initial: "D" },
  ];
  const contents = [
    "Looking at BTC structure here — this level has held 3x on the 4H. If we get a clean bounce I'm adding to my long.",
    "What's your take on the ETH funding flip?",
    "Good call on that SOL entry 🎯",
    "Anyone else seeing the divergence on the 1D?",
    "Just published a new signal — check the signals tab",
    "That stop was tight, nice R:R on that one",
    "The liquidation cluster at 64k is massive. Watching closely.",
    "Agree with the thesis. OI building nicely.",
    "When do you think the breakout happens?",
    "Patience. The setup needs time to develop.",
    "That funding rate is getting extreme",
    "New annotation on the BTC chart — check the support zone I drew",
  ];

  for (let i = 0; i < 12; i++) {
    const user = users[i % users.length];
    const isReply = i === 2 || i === 5 || i === 9;
    msgs.push({
      id: `msg-${roomId}-${i}`,
      roomId,
      authorId: user.id,
      authorName: user.name,
      authorInitial: user.initial,
      content: contents[i],
      replyToId: isReply ? `msg-${roomId}-${i - 1}` : null,
      replyToContent: isReply ? contents[i - 1].slice(0, 50) + "..." : null,
      replyToAuthor: isReply ? users[(i - 1) % users.length].name : null,
      isPinned: i === 0,
      isDeleted: false,
      createdAt: new Date(now - (12 - i) * 300000).toISOString(),
    });
  }
  return msgs;
}

function generateMockAnnouncements(analystId: string, analystName: string): Announcement[] {
  const now = Date.now();
  return [
    {
      id: `ann-${analystId}-1`,
      analystId,
      analystName,
      title: "Weekly Market Outlook",
      content: "BTC holding above key support. Watching for a breakout above 68k for continuation. ETH looks constructive with funding neutral. SOL needs to reclaim 150 for bullish bias. Stay patient — setups are forming.",
      isPinned: true,
      createdAt: new Date(now - 3600000).toISOString(),
    },
    {
      id: `ann-${analystId}-2`,
      analystId,
      analystName,
      title: "New Signal Published",
      content: "Just published a high-conviction BTC long signal. Entry, target, and stop are live on the signals tab. This is a swing setup — expect 3-7 day hold time.",
      isPinned: false,
      createdAt: new Date(now - 86400000).toISOString(),
    },
    {
      id: `ann-${analystId}-3`,
      analystId,
      analystName,
      title: "Performance Update",
      content: "Another strong week: 4/5 signals hit target. Running a 78% win rate over the last 30 days. The key is patience and waiting for high-probability setups at key levels.",
      isPinned: false,
      createdAt: new Date(now - 172800000).toISOString(),
    },
  ];
}

interface ChatState {
  isOpen: boolean;
  activeRoom: string | null;
  activeTab: "chat" | "announcements";
  rooms: ChatRoom[];
  messages: Record<string, ChatMessage[]>;
  announcements: Record<string, Announcement[]>;
  replyingTo: ChatMessage | null;

  toggleDrawer: () => void;
  setActiveRoom: (roomId: string) => void;
  setActiveTab: (tab: "chat" | "announcements") => void;
  sendMessage: (content: string) => void;
  setReplyingTo: (msg: ChatMessage | null) => void;
  pinMessage: (msgId: string) => void;
  deleteMessage: (msgId: string) => void;
  createAnnouncement: (title: string, content: string) => void;
  markRoomRead: (roomId: string) => void;
  getTotalUnread: () => number;
}

export const useChatStore = create<ChatState>((set, get) => ({
  isOpen: false,
  activeRoom: null,
  activeTab: "chat",
  rooms: [
    { analystId: "crypto-rex", analystName: "CryptoRex", analystInitial: "C", unreadCount: 3 },
    { analystId: "degen-sensei", analystName: "DegenSensei", analystInitial: "D", unreadCount: 1 },
  ],
  messages: {
    "crypto-rex": generateMockMessages("crypto-rex", "CryptoRex"),
    "degen-sensei": generateMockMessages("degen-sensei", "DegenSensei"),
  },
  announcements: {
    "crypto-rex": generateMockAnnouncements("crypto-rex", "CryptoRex"),
    "degen-sensei": generateMockAnnouncements("degen-sensei", "DegenSensei"),
  },
  replyingTo: null,

  toggleDrawer: () =>
    set((state) => {
      const opening = !state.isOpen;
      return {
        isOpen: opening,
        activeRoom: opening && !state.activeRoom && state.rooms.length > 0
          ? state.rooms[0].analystId
          : state.activeRoom,
      };
    }),

  setActiveRoom: (roomId) => set({ activeRoom: roomId, replyingTo: null }),

  setActiveTab: (tab) => set({ activeTab: tab }),

  sendMessage: (content) =>
    set((state) => {
      const room = state.activeRoom;
      if (!room) return state;
      const newMsg: ChatMessage = {
        id: `msg-${room}-${Date.now()}`,
        roomId: room,
        authorId: "current-user",
        authorName: "You",
        authorInitial: "Y",
        content,
        replyToId: state.replyingTo?.id || null,
        replyToContent: state.replyingTo?.content.slice(0, 50) || null,
        replyToAuthor: state.replyingTo?.authorName || null,
        isPinned: false,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };
      return {
        messages: {
          ...state.messages,
          [room]: [...(state.messages[room] || []), newMsg],
        },
        replyingTo: null,
      };
    }),

  setReplyingTo: (msg) => set({ replyingTo: msg }),

  pinMessage: (msgId) =>
    set((state) => {
      const room = state.activeRoom;
      if (!room) return state;
      return {
        messages: {
          ...state.messages,
          [room]: (state.messages[room] || []).map((m) =>
            m.id === msgId ? { ...m, isPinned: !m.isPinned } : m
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
            m.id === msgId ? { ...m, isDeleted: true, content: "[deleted]" } : m
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
        r.analystId === roomId ? { ...r, unreadCount: 0 } : r
      ),
    })),

  getTotalUnread: () => get().rooms.reduce((sum, r) => sum + r.unreadCount, 0),
}));
