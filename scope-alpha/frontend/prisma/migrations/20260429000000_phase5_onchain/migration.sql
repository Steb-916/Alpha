-- Phase 5: On-Chain Analytics
-- CreateTable: OnChainSnapshot
CREATE TABLE "OnChainSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "mvrvZScore" DOUBLE PRECISION,
    "sopr" DOUBLE PRECISION,
    "nvtRatio" DOUBLE PRECISION,
    "nvtSignal" DOUBLE PRECISION,
    "activeAddresses" DOUBLE PRECISION,
    "supplyOnExchanges" DOUBLE PRECISION,
    "realizedCap" DOUBLE PRECISION,
    "marketCap" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnChainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable: ExchangeFlowSnapshot
CREATE TABLE "ExchangeFlowSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "inflowNative" DOUBLE PRECISION NOT NULL,
    "outflowNative" DOUBLE PRECISION NOT NULL,
    "netFlowNative" DOUBLE PRECISION NOT NULL,
    "inflowUsd" DOUBLE PRECISION,
    "outflowUsd" DOUBLE PRECISION,
    "netFlowUsd" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeFlowSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OnChainSnapshot_asset_timestamp_key" ON "OnChainSnapshot"("asset", "timestamp");
CREATE INDEX "OnChainSnapshot_asset_timestamp_idx" ON "OnChainSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeFlowSnapshot_asset_timestamp_key" ON "ExchangeFlowSnapshot"("asset", "timestamp");
CREATE INDEX "ExchangeFlowSnapshot_asset_timestamp_idx" ON "ExchangeFlowSnapshot"("asset", "timestamp");
