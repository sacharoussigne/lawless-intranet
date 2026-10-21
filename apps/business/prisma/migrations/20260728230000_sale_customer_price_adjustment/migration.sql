-- AlterTable
ALTER TABLE "sale" ADD COLUMN "customerName" TEXT;
ALTER TABLE "sale" ADD COLUMN "description" TEXT;
ALTER TABLE "sale" ADD COLUMN "individualCustomerId" TEXT;

-- AlterTable
ALTER TABLE "sale_item" ADD COLUMN "priceAdjustment" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "sale_individualCustomerId_idx" ON "sale"("individualCustomerId");

-- AddForeignKey
ALTER TABLE "sale" ADD CONSTRAINT "sale_individualCustomerId_fkey" FOREIGN KEY ("individualCustomerId") REFERENCES "individual_customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
