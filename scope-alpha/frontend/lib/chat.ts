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
