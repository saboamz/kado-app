-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('purchase', 'reserve', 'contribute', 'add_wish', 'like_wish', 'click_out', 'view_wish', 'view_product', 'unreserve', 'dismiss_reco');

-- CreateTable
CREATE TABLE "GiftEvent" (
    "id" BIGSERIAL NOT NULL,
    "actorId" TEXT NOT NULL,
    "kind" "EventKind" NOT NULL,
    "recipientId" TEXT,
    "productId" TEXT,
    "giftId" TEXT,
    "categoryId" TEXT,
    "priceCents" INTEGER,
    "weight" DOUBLE PRECISION NOT NULL,
    "sessionId" TEXT,
    "source" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GiftEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GiftEvent_actorId_productId_idx" ON "GiftEvent"("actorId", "productId");

-- CreateIndex
CREATE INDEX "GiftEvent_productId_kind_occurredAt_idx" ON "GiftEvent"("productId", "kind", "occurredAt");

-- CreateIndex
CREATE INDEX "GiftEvent_occurredAt_idx" ON "GiftEvent"("occurredAt");

-- One view per session per product, for the browsing kinds only.
--
-- Partial, and written by hand because Prisma cannot put a WHERE clause on an
-- index. Applying it to every kind would be wrong: someone really can reserve
-- a product, release it, and reserve it again, and a blanket unique index
-- would silently swallow the second reservation.
--
-- COALESCE because a null sessionId does not collide with itself in SQL, so a
-- client that omitted one would slip past the cap entirely.
CREATE UNIQUE INDEX "GiftEvent_one_view_per_session"
  ON "GiftEvent" ("actorId", COALESCE("sessionId", ''), COALESCE("productId", ''), "kind")
  WHERE "kind" IN ('view_product', 'view_wish');
