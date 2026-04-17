-- CreateTable
CREATE TABLE "HealthScoreSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "regime" TEXT NOT NULL,
    "funding" DOUBLE PRECISION NOT NULL,
    "oi" DOUBLE PRECISION NOT NULL,
    "liquidation" DOUBLE PRECISION NOT NULL,
    "basis" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HealthScoreSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HealthScoreSnapshot_asset_timestamp_idx" ON "HealthScoreSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "HealthScoreSnapshot_asset_timestamp_key" ON "HealthScoreSnapshot"("asset", "timestamp");
