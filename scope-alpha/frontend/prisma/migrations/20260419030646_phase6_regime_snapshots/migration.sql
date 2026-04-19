-- CreateTable
CREATE TABLE "RegimeSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "rawClassification" TEXT NOT NULL,
    "committedRegime" TEXT NOT NULL,
    "regimeChanged" BOOLEAN NOT NULL DEFAULT false,
    "prevRegime" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL,
    "featureVector" JSONB NOT NULL,
    "featureSupport" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegimeSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RegimeSnapshot_asset_timestamp_idx" ON "RegimeSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "RegimeSnapshot_committedRegime_timestamp_idx" ON "RegimeSnapshot"("committedRegime", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "RegimeSnapshot_asset_timestamp_key" ON "RegimeSnapshot"("asset", "timestamp");
