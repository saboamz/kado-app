-- CreateTable
CREATE TABLE "Recommendation" (
    "id" BIGSERIAL NOT NULL,
    "viewerId" TEXT NOT NULL,
    "recipientId" TEXT,
    "productId" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "strategy" TEXT NOT NULL,
    "becauseProductId" TEXT,
    "rank" INTEGER NOT NULL,
    "batchId" TEXT NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Recommendation_viewerId_recipientId_batchId_idx" ON "Recommendation"("viewerId", "recipientId", "batchId");

-- CreateIndex
CREATE INDEX "Recommendation_batchId_idx" ON "Recommendation"("batchId");

-- CreateIndex
CREATE INDEX "Recommendation_strategy_idx" ON "Recommendation"("strategy");
