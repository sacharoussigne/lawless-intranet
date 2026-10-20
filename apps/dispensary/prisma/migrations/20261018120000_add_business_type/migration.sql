-- CreateEnum
CREATE TYPE "BusinessType" AS ENUM ('DISPENSARY');

-- AlterTable
ALTER TABLE "dispensary" ADD COLUMN     "type" "BusinessType" NOT NULL DEFAULT 'DISPENSARY';

