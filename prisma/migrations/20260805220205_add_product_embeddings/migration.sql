-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "embeddedAt" TIMESTAMP(3),
ADD COLUMN     "embedding" vector(384),
ADD COLUMN     "embeddingModel" TEXT;

-- HNSW, not IVFFlat.
--
-- IVFFlat needs a training pass over existing rows to build its lists, and it
-- degrades once the catalogue grows past the size it was trained on — which is
-- exactly the regime of a launch, where the catalogue starts near empty and
-- grows continuously. HNSW builds incrementally and needs no retraining.
--
-- vector_cosine_ops because the taste vector is compared by cosine distance;
-- an L2 index would answer a different question.
CREATE INDEX "Product_embedding_hnsw"
  ON "Product" USING hnsw (embedding vector_cosine_ops);

-- Finding what still needs embedding is a cron query, so it gets an index.
CREATE INDEX "Product_embedding_pending"
  ON "Product" ("embeddedAt")
  WHERE embedding IS NULL;
