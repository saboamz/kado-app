-- AlterTable
ALTER TABLE "Gift" ADD COLUMN     "productId" TEXT;

-- CreateTable
CREATE TABLE "Merchant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "domains" TEXT[],

    CONSTRAINT "Merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "merchantId" TEXT,
    "title" TEXT NOT NULL,
    "brand" TEXT,
    "description" TEXT,
    "imageUrl" TEXT,
    "sourceUrl" TEXT,
    "urlNorm" TEXT,
    "urlHash" TEXT,
    "titleKey" TEXT,
    "gtin" TEXT,
    "priceCents" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "priceBand" INTEGER,
    "categoryId" TEXT,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'active',
    "mergedInto" TEXT,
    "extractedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Merchant_slug_key" ON "Merchant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Product_urlHash_key" ON "Product"("urlHash");

-- CreateIndex
CREATE UNIQUE INDEX "Product_gtin_key" ON "Product"("gtin");

-- CreateIndex
CREATE INDEX "Product_categoryId_priceBand_idx" ON "Product"("categoryId", "priceBand");

-- CreateIndex
CREATE INDEX "Product_popularity_idx" ON "Product"("popularity");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Product_merchantId_titleKey_key" ON "Product"("merchantId", "titleKey");

-- CreateIndex
CREATE INDEX "Gift_productId_idx" ON "Gift"("productId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_merchantId_fkey" FOREIGN KEY ("merchantId") REFERENCES "Merchant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Gift" ADD CONSTRAINT "Gift_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
