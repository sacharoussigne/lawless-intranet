-- AlterTable
ALTER TABLE "sale" ADD COLUMN     "depositedByUserId" TEXT,
ADD COLUMN     "depositedInCashRegister" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "depositedInCashRegisterAt" TIMESTAMP(3);
