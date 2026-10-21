-- AlterEnum
ALTER TYPE "StockMovementKind" ADD VALUE 'TRANSFER_OUT';
ALTER TYPE "StockMovementKind" ADD VALUE 'TRANSFER_IN';
ALTER TYPE "StockMovementKind" ADD VALUE 'OVERWRITE';

-- AlterTable
ALTER TABLE "stock_item_movement" ADD COLUMN "chestId" TEXT;
ALTER TABLE "stock_item_movement" ADD COLUMN "destinationChestId" TEXT;
ALTER TABLE "stock_item_movement" ADD COLUMN "note" TEXT;

-- CreateIndex
CREATE INDEX "stock_item_movement_chestId_createdAt_idx" ON "stock_item_movement"("chestId", "createdAt");
CREATE INDEX "stock_item_movement_itemId_chestId_createdAt_idx" ON "stock_item_movement"("itemId", "chestId", "createdAt");

-- AddForeignKey
ALTER TABLE "stock_item_movement" ADD CONSTRAINT "stock_item_movement_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_item_movement" ADD CONSTRAINT "stock_item_movement_destinationChestId_fkey" FOREIGN KEY ("destinationChestId") REFERENCES "chest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
