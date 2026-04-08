-- Phase 6: Community & Engagement (6A + 6B)
--
-- Adds:
--   Chat V2 (6A): ChatReadReceipt, ChatRoomMember, ChatMessage media/moderation/messageType fields
--   Social Feed (6B): FeedEvent, Follow, SignalLike, SignalBookmark, Signal.likeCount
--
-- Pure additive migration. No destructive ops, no column type changes.
-- All existing chat messages default to messageType='message' and deletedAt=null.
-- The existing isDeleted boolean is preserved for backward compat.
--
-- THIS FILE IS NOT YET APPLIED. Run `prisma migrate deploy` to apply.

-- ─── ChatMessage additions ─────────────────────────────────────────────────
ALTER TABLE "ChatMessage" ADD COLUMN "mediaUrl" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "mediaType" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "deletedAt" TIMESTAMP(3);
ALTER TABLE "ChatMessage" ADD COLUMN "deletedBy" TEXT;
ALTER TABLE "ChatMessage" ADD COLUMN "messageType" TEXT NOT NULL DEFAULT 'message';

-- ─── Signal additions ──────────────────────────────────────────────────────
ALTER TABLE "Signal" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

-- ─── ChatReadReceipt (new) ─────────────────────────────────────────────────
CREATE TABLE "ChatReadReceipt" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadMessageId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatReadReceipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatReadReceipt_roomId_userId_key"
    ON "ChatReadReceipt"("roomId", "userId");
CREATE INDEX "ChatReadReceipt_roomId_idx" ON "ChatReadReceipt"("roomId");

ALTER TABLE "ChatReadReceipt"
    ADD CONSTRAINT "ChatReadReceipt_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ChatRoomMember (new) ──────────────────────────────────────────────────
CREATE TABLE "ChatRoomMember" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "mutedAt" TIMESTAMP(3),
    "mutedUntil" TIMESTAMP(3),
    "bannedAt" TIMESTAMP(3),
    "reason" TEXT,

    CONSTRAINT "ChatRoomMember_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatRoomMember_roomId_userId_key"
    ON "ChatRoomMember"("roomId", "userId");
CREATE INDEX "ChatRoomMember_roomId_idx" ON "ChatRoomMember"("roomId");

ALTER TABLE "ChatRoomMember"
    ADD CONSTRAINT "ChatRoomMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── FeedEvent (new) ───────────────────────────────────────────────────────
CREATE TABLE "FeedEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "analystId" TEXT,
    "signalId" TEXT,
    "metadata" JSONB,
    "visibility" TEXT NOT NULL DEFAULT 'public',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FeedEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FeedEvent_analystId_createdAt_idx"
    ON "FeedEvent"("analystId", "createdAt");
CREATE INDEX "FeedEvent_actorId_createdAt_idx"
    ON "FeedEvent"("actorId", "createdAt");
CREATE INDEX "FeedEvent_createdAt_idx" ON "FeedEvent"("createdAt");
CREATE INDEX "FeedEvent_type_createdAt_idx" ON "FeedEvent"("type", "createdAt");

ALTER TABLE "FeedEvent"
    ADD CONSTRAINT "FeedEvent_actorId_fkey"
    FOREIGN KEY ("actorId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Follow (new) ──────────────────────────────────────────────────────────
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerId" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Follow_followerId_analystId_key"
    ON "Follow"("followerId", "analystId");
CREATE INDEX "Follow_followerId_idx" ON "Follow"("followerId");
CREATE INDEX "Follow_analystId_idx" ON "Follow"("analystId");

ALTER TABLE "Follow"
    ADD CONSTRAINT "Follow_followerId_fkey"
    FOREIGN KEY ("followerId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Follow"
    ADD CONSTRAINT "Follow_analystId_fkey"
    FOREIGN KEY ("analystId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── SignalLike (new) ──────────────────────────────────────────────────────
CREATE TABLE "SignalLike" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignalLike_userId_signalId_key"
    ON "SignalLike"("userId", "signalId");
CREATE INDEX "SignalLike_signalId_idx" ON "SignalLike"("signalId");

ALTER TABLE "SignalLike"
    ADD CONSTRAINT "SignalLike_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SignalLike"
    ADD CONSTRAINT "SignalLike_signalId_fkey"
    FOREIGN KEY ("signalId") REFERENCES "Signal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── SignalBookmark (new) ──────────────────────────────────────────────────
CREATE TABLE "SignalBookmark" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SignalBookmark_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SignalBookmark_userId_signalId_key"
    ON "SignalBookmark"("userId", "signalId");
CREATE INDEX "SignalBookmark_userId_createdAt_idx"
    ON "SignalBookmark"("userId", "createdAt");
CREATE INDEX "SignalBookmark_signalId_idx" ON "SignalBookmark"("signalId");

ALTER TABLE "SignalBookmark"
    ADD CONSTRAINT "SignalBookmark_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SignalBookmark"
    ADD CONSTRAINT "SignalBookmark_signalId_fkey"
    FOREIGN KEY ("signalId") REFERENCES "Signal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
