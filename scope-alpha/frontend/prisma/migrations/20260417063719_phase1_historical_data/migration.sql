-- CreateTable
CREATE TABLE "FundingRateSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "markPrice" DOUBLE PRECISION NOT NULL,
    "indexPrice" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FundingRateSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OISnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "oi" DOUBLE PRECISION NOT NULL,
    "oiUsd" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OISnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LiquidationEvent" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "usdValue" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiquidationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CandleHistory" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "timeframe" TEXT NOT NULL,
    "open" DOUBLE PRECISION NOT NULL,
    "high" DOUBLE PRECISION NOT NULL,
    "low" DOUBLE PRECISION NOT NULL,
    "close" DOUBLE PRECISION NOT NULL,
    "volume" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CandleHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FundingRateSnapshot_asset_timestamp_idx" ON "FundingRateSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "FundingRateSnapshot_asset_exchange_timestamp_idx" ON "FundingRateSnapshot"("asset", "exchange", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "FundingRateSnapshot_asset_exchange_timestamp_key" ON "FundingRateSnapshot"("asset", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "OISnapshot_asset_timestamp_idx" ON "OISnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OISnapshot_asset_exchange_timestamp_key" ON "OISnapshot"("asset", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "LiquidationEvent_asset_timestamp_idx" ON "LiquidationEvent"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "LiquidationEvent_asset_exchange_timestamp_idx" ON "LiquidationEvent"("asset", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "LiquidationEvent_timestamp_idx" ON "LiquidationEvent"("timestamp");

-- CreateIndex
CREATE INDEX "CandleHistory_asset_timeframe_timestamp_idx" ON "CandleHistory"("asset", "timeframe", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "CandleHistory_asset_exchange_timeframe_timestamp_key" ON "CandleHistory"("asset", "exchange", "timeframe", "timestamp");
