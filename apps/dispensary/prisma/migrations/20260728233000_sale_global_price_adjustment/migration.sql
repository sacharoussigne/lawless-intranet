-- AlterTable
ALTER TABLE "sale" ADD COLUMN "priceAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "sale_item" DROP COLUMN "priceAdjustment";
