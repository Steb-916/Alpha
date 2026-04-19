-- CreateTable
CREATE TABLE "OnChainSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "marketCapUsd" DOUBLE PRECISION,
    "realizedCapUsd" DOUBLE PRECISION,
    "supplyNative" DOUBLE PRECISION,
    "activeAddresses" INTEGER,
    "txCount" INTEGER,
    "txVolumeUsd" DOUBLE PRECISION,
    "feesUsd" DOUBLE PRECISION,
    "mvrv" DOUBLE PRECISION,
    "mvrvZScore" DOUBLE PRECISION,
    "mvrvRegime" TEXT,
    "sopr" DOUBLE PRECISION,
    "soprState" TEXT,
    "nvt" DOUBLE PRECISION,
    "nvtRegime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnChainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExchangeFlowSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "exchange" TEXT NOT NULL,
    "netFlowUsd" DOUBLE PRECISION NOT NULL,
    "inflowUsd" DOUBLE PRECISION NOT NULL,
    "outflowUsd" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExchangeFlowSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhaleTransaction" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "valueUsd" DOUBLE PRECISION NOT NULL,
    "fromAddress" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "fromLabel" TEXT,
    "toLabel" TEXT,
    "classification" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhaleTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StablecoinSnapshot" (
    "id" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "totalSupplyUsd" DOUBLE PRECISION NOT NULL,
    "exchangeBalanceUsd" DOUBLE PRECISION NOT NULL,
    "exchangeBalancePct" DOUBLE PRECISION NOT NULL,
    "usdtSupplyUsd" DOUBLE PRECISION NOT NULL,
    "usdcSupplyUsd" DOUBLE PRECISION NOT NULL,
    "daiSupplyUsd" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StablecoinSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnChainSnapshot_asset_timestamp_idx" ON "OnChainSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OnChainSnapshot_asset_timestamp_key" ON "OnChainSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "ExchangeFlowSnapshot_asset_timestamp_idx" ON "ExchangeFlowSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "ExchangeFlowSnapshot_asset_exchange_timestamp_key" ON "ExchangeFlowSnapshot"("asset", "exchange", "timestamp");

-- CreateIndex
CREATE INDEX "WhaleTransaction_asset_timestamp_idx" ON "WhaleTransaction"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "WhaleTransaction_classification_timestamp_idx" ON "WhaleTransaction"("classification", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "WhaleTransaction_txHash_key" ON "WhaleTransaction"("txHash");

-- CreateIndex
CREATE UNIQUE INDEX "StablecoinSnapshot_timestamp_key" ON "StablecoinSnapshot"("timestamp");

-- CreateIndex
CREATE INDEX "StablecoinSnapshot_timestamp_idx" ON "StablecoinSnapshot"("timestamp");
