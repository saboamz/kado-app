-- CreateTable
CREATE TABLE "ItemSimilarity" (
    "productId" TEXT NOT NULL,
    "neighborId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "support" INTEGER NOT NULL,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ItemSimilarity_pkey" PRIMARY KEY ("productId","neighborId")
);

-- CreateIndex
CREATE INDEX "ItemSimilarity_productId_score_idx" ON "ItemSimilarity"("productId", "score");
