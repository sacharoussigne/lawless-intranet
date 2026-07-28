-- AlterEnum
ALTER TYPE "StockMovementKind" ADD VALUE 'TAKE_OUT';
ALTER TYPE "StockMovementKind" ADD VALUE 'SALE_OUT';
ALTER TYPE "StockMovementKind" ADD VALUE 'SALE_CANCEL_RESTORE';

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'CANCELLED');
CREATE TYPE "SaleItemSource" AS ENUM ('POCKET', 'CHEST');

-- CreateTable
CREATE TABLE "sale" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),
    "cancelledByUserId" TEXT,

    CONSTRAINT "sale_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "sale_item" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2),
    "source" "SaleItemSource" NOT NULL,
    "chestId" TEXT,

    CONSTRAINT "sale_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sale_dispensaryId_createdAt_idx" ON "sale"("dispensaryId", "createdAt");
CREATE INDEX "sale_dispensaryId_userId_createdAt_idx" ON "sale"("dispensaryId", "userId", "createdAt");
CREATE INDEX "sale_userId_idx" ON "sale"("userId");
CREATE INDEX "sale_item_saleId_idx" ON "sale_item"("saleId");
CREATE INDEX "sale_item_itemId_idx" ON "sale_item"("itemId");
CREATE INDEX "sale_item_chestId_idx" ON "sale_item"("chestId");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sale_item" ADD CONSTRAINT "sale_item_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
