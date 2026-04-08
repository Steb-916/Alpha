-- Phase 4: Analyst Experience Polish (4A + 4B)
--
-- Adds multi-target signals, signal templates, drawdown analytics fields,
-- and screenshot URL / template foreign key on Signal.
--
-- This migration is ADDITIVE ONLY. Existing single-target signals continue
-- to work via the legacy `targetPrice` column. The new `targets` relation
-- coexists; the application synthesizes a single TP1 from `targetPrice`
-- when no SignalTarget rows are present.
--
-- The only "change" to existing rows is making `Signal.publishedAt`
-- nullable so drafts can have null publishedAt until they're published.
-- Existing rows have non-null publishedAt and remain unaffected.
--
-- THIS FILE IS NOT YET APPLIED. Run `prisma migrate deploy` to apply.

-- Signal: nullable publishedAt + new columns
ALTER TABLE "Signal" ALTER COLUMN "publishedAt" DROP NOT NULL;
ALTER TABLE "Signal" ADD COLUMN "templateId" TEXT;
ALTER TABLE "Signal" ADD COLUMN "screenshotUrl" TEXT;

-- AnalystPerformance: drawdown columns
ALTER TABLE "AnalystPerformance" ADD COLUMN "maxDrawdownPct" DOUBLE PRECISION;
ALTER TABLE "AnalystPerformance" ADD COLUMN "currentDrawdownPct" DOUBLE PRECISION;
ALTER TABLE "AnalystPerformance" ADD COLUMN "maxDrawdownDate" TIMESTAMP(3);

-- SignalTemplate (new)
CREATE TABLE "SignalTemplate" (
    "id" TEXT NOT NULL,
    "analystId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "asset" TEXT,
    "direction" TEXT,
    "timeframe" TEXT,
    "conviction" TEXT,
    "stopPercent" DOUBLE PRECISION,
    "targets" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SignalTemplate_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignalTemplate_analystId_idx" ON "SignalTemplate"("analystId");

ALTER TABLE "SignalTemplate"
    ADD CONSTRAINT "SignalTemplate_analystId_fkey"
    FOREIGN KEY ("analystId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- SignalTarget (new)
CREATE TABLE "SignalTarget" (
    "id" TEXT NOT NULL,
    "signalId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "price" DECIMAL(20,8) NOT NULL,
    "closePercent" DOUBLE PRECISION NOT NULL,
    "hitAt" TIMESTAMP(3),
    "hitPrice" DECIMAL(20,8),
    "order" INTEGER NOT NULL,

    CONSTRAINT "SignalTarget_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SignalTarget_signalId_order_idx" ON "SignalTarget"("signalId", "order");

ALTER TABLE "SignalTarget"
    ADD CONSTRAINT "SignalTarget_signalId_fkey"
    FOREIGN KEY ("signalId") REFERENCES "Signal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Signal → SignalTemplate FK + new index
CREATE INDEX "Signal_analystId_status_publishedAt_idx"
    ON "Signal"("analystId", "status", "publishedAt");

ALTER TABLE "Signal"
    ADD CONSTRAINT "Signal_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "SignalTemplate"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
