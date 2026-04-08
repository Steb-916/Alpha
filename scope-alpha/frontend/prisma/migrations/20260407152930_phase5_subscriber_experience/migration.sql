-- Phase 5: Subscriber Experience Polish (5A + 5B + 5C)
--
-- Adds:
--   - TrackedSignal model (subscriber portfolio tracking)
--   - ReviewVote model (helpful/unhelpful votes)
--   - Review fields: helpfulCount, unhelpfulCount, verifiedSubscriber, subscriptionTier
--
-- Pure additive migration. No destructive ops, no column type changes.
-- All existing rows get sensible defaults (helpfulCount=0, verifiedSubscriber=false).
--
-- THIS FILE IS NOT YET APPLIED. Run `prisma migrate deploy` to apply.

-- ─── Review additions ──────────────────────────────────────────────────────
ALTER TABLE "Review" ADD COLUMN "helpfulCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Review" ADD COLUMN "unhelpfulCount" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Review" ADD COLUMN "verifiedSubscriber" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Review" ADD COLUMN "subscriptionTier" TEXT;

CREATE INDEX "Review_analystId_helpfulCount_idx"
    ON "Review"("analystId", "helpfulCount");

-- ─── TrackedSignal (new) ───────────────────────────────────────────────────
CREATE TABLE "TrackedSignal" (
    "id" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "personalEntry" DECIMAL(20,8),
    "personalStop" DECIMAL(20,8),
    "positionSize" DECIMAL(20,8),
    "status" TEXT NOT NULL DEFAULT 'active',
    "closedAt" TIMESTAMP(3),
    "closePrice" DECIMAL(20,8),
    "personalPnl" DECIMAL(10,4),
    "notes" TEXT,

    CONSTRAINT "TrackedSignal_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TrackedSignal_subscriberId_signalId_key"
    ON "TrackedSignal"("subscriberId", "signalId");

CREATE INDEX "TrackedSignal_subscriberId_status_idx"
    ON "TrackedSignal"("subscriberId", "status");

CREATE INDEX "TrackedSignal_subscriberId_analystId_idx"
    ON "TrackedSignal"("subscriberId", "analystId");

ALTER TABLE "TrackedSignal"
    ADD CONSTRAINT "TrackedSignal_subscriberId_fkey"
    FOREIGN KEY ("subscriberId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackedSignal"
    ADD CONSTRAINT "TrackedSignal_analystId_fkey"
    FOREIGN KEY ("analystId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TrackedSignal"
    ADD CONSTRAINT "TrackedSignal_signalId_fkey"
    FOREIGN KEY ("signalId") REFERENCES "Signal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── ReviewVote (new) ──────────────────────────────────────────────────────
CREATE TABLE "ReviewVote" (
    "id" TEXT NOT NULL,
    "reviewId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReviewVote_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ReviewVote_reviewId_userId_key"
    ON "ReviewVote"("reviewId", "userId");

CREATE INDEX "ReviewVote_reviewId_idx" ON "ReviewVote"("reviewId");

ALTER TABLE "ReviewVote"
    ADD CONSTRAINT "ReviewVote_reviewId_fkey"
    FOREIGN KEY ("reviewId") REFERENCES "Review"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ReviewVote"
    ADD CONSTRAINT "ReviewVote_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
