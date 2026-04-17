-- CreateTable
CREATE TABLE "OptionsChainSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "instrumentName" TEXT NOT NULL,
    "strike" DOUBLE PRECISION NOT NULL,
    "expiration" TIMESTAMP(3) NOT NULL,
    "optionType" TEXT NOT NULL,
    "markPrice" DOUBLE PRECISION NOT NULL,
    "markIV" DOUBLE PRECISION NOT NULL,
    "bidIV" DOUBLE PRECISION,
    "askIV" DOUBLE PRECISION,
    "underlyingPrice" DOUBLE PRECISION NOT NULL,
    "openInterest" DOUBLE PRECISION NOT NULL,
    "volume24h" DOUBLE PRECISION NOT NULL,
    "delta" DOUBLE PRECISION,
    "gamma" DOUBLE PRECISION,
    "vega" DOUBLE PRECISION,
    "theta" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OptionsChainSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VolSurfaceSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "surfaceData" JSONB NOT NULL,
    "atmIV30d" DOUBLE PRECISION,
    "atmIV90d" DOUBLE PRECISION,
    "skew25d30d" DOUBLE PRECISION,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VolSurfaceSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IVSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "iv7d" DOUBLE PRECISION,
    "iv30d" DOUBLE PRECISION,
    "iv60d" DOUBLE PRECISION,
    "iv90d" DOUBLE PRECISION,
    "iv180d" DOUBLE PRECISION,
    "skew25d7d" DOUBLE PRECISION,
    "skew25d30d" DOUBLE PRECISION,
    "skew25d90d" DOUBLE PRECISION,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IVSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OptionsChainSnapshot_asset_timestamp_idx" ON "OptionsChainSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "OptionsChainSnapshot_asset_expiration_timestamp_idx" ON "OptionsChainSnapshot"("asset", "expiration", "timestamp");

-- CreateIndex
CREATE INDEX "OptionsChainSnapshot_asset_strike_optionType_timestamp_idx" ON "OptionsChainSnapshot"("asset", "strike", "optionType", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "OptionsChainSnapshot_asset_instrumentName_timestamp_key" ON "OptionsChainSnapshot"("asset", "instrumentName", "timestamp");

-- CreateIndex
CREATE INDEX "VolSurfaceSnapshot_asset_timestamp_idx" ON "VolSurfaceSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "VolSurfaceSnapshot_asset_timestamp_key" ON "VolSurfaceSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE INDEX "IVSnapshot_asset_timestamp_idx" ON "IVSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "IVSnapshot_asset_timestamp_key" ON "IVSnapshot"("asset", "timestamp");
