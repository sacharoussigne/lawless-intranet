-- AlterTable
ALTER TABLE "bank_transaction" ADD COLUMN "orderId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bank_transaction_orderId_key" ON "bank_transaction"("orderId");

-- AddForeignKey
ALTER TABLE "bank_transaction" ADD CONSTRAINT "bank_transaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;
