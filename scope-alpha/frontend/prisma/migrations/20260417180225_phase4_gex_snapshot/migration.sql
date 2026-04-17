-- CreateTable
CREATE TABLE "GEXSnapshot" (
    "id" TEXT NOT NULL,
    "asset" TEXT NOT NULL,
    "gammaFlip" DOUBLE PRECISION NOT NULL,
    "totalGex" DOUBLE PRECISION NOT NULL,
    "regime" TEXT NOT NULL,
    "callWall" DOUBLE PRECISION NOT NULL,
    "putWall" DOUBLE PRECISION NOT NULL,
    "levelsData" JSONB NOT NULL,
    "spotPrice" DOUBLE PRECISION NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GEXSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GEXSnapshot_asset_timestamp_idx" ON "GEXSnapshot"("asset", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "GEXSnapshot_asset_timestamp_key" ON "GEXSnapshot"("asset", "timestamp");
