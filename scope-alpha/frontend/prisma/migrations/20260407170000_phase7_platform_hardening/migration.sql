-- Phase 7: Platform Hardening
-- Additive only. Adds session tracking + acceptance gate columns.
-- Safe to run on a populated database; existing rows get NULL for the new
-- nullable columns.

-- ── User additions ────────────────────────────────────────────────────────
ALTER TABLE "User" ADD COLUMN "tosAcceptedAt"              TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "analystAgreementAcceptedAt" TIMESTAMP(3);

-- ── UserSession ───────────────────────────────────────────────────────────
-- Tracks JWT session lineage so individual sessions can be revoked.
-- Distinct from the NextAuth `Session` table (which is unused by JWT
-- strategy but exists from the PrismaAdapter scaffold).
CREATE TABLE "UserSession" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "userAgent"  TEXT,
  "ipAddress"  TEXT,
  "lastActive" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "revokedAt"  TIMESTAMP(3),

  CONSTRAINT "UserSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserSession_token_key" ON "UserSession"("token");
CREATE INDEX        "UserSession_userId_idx" ON "UserSession"("userId");
CREATE INDEX        "UserSession_token_idx"  ON "UserSession"("token");

ALTER TABLE "UserSession"
  ADD CONSTRAINT "UserSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
