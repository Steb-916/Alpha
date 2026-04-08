// Chat & Announcement types

export interface ChatMessage {
  id: string;
  roomId: string;
  authorId: string;
  authorName: string;
  authorInitial: string;
  content: string;
  replyToId: string | null;
  replyToContent: string | null;
  replyToAuthor: string | null;
  isPinned: boolean;
  isDeleted: boolean;
  createdAt: string;
  // Phase 6 additions (optional for backward compat with mock data)
  mediaUrl?: string | null;
  mediaType?: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  messageType?: "message" | "announcement" | "system";
}

// Phase 6: per-room moderation snapshot returned by GET /api/chat/[roomId]
export interface ChatRoomModerationState {
  role: "member" | "muted" | "banned";
  mutedUntil: string | null;
  bannedAt: string | null;
}

// Phase 6: read receipt summary returned by GET /api/chat/[roomId]
export interface ChatReadReceiptEntry {
  userId: string;
  lastReadMessageId: string;
}

// Phase 6: presence response shape
export interface ChatPresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
}

export interface ChatPresenceData {
  online: ChatPresenceUser[];
  typing: ChatPresenceUser[];
}

export interface Announcement {
  id: string;
  analystId: string;
  analystName: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
}

export interface ChatRoom {
  analystId: string;
  analystName: string;
  analystInitial: string;
  unreadCount: number;
}
