-- CreateEnum
CREATE TYPE "AnimalFollowUpStatus" AS ENUM (
  'initial',
  'awaiting_recipient',
  'no_reply',
  'awaiting_shelter',
  'cancelled',
  'validated',
  'refused'
);

-- CreateEnum
CREATE TYPE "AnimalFollowUpMessageSide" AS ENUM ('shelter', 'recipient');

-- CreateTable
CREATE TABLE "animal_follow_up" (
    "id" TEXT NOT NULL,
    "animalId" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "motif" TEXT NOT NULL,
    "status" "AnimalFollowUpStatus" NOT NULL DEFAULT 'initial',
    "conductedByUserId" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "closureNote" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_follow_up_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_follow_up_message" (
    "id" TEXT NOT NULL,
    "followUpId" TEXT NOT NULL,
    "side" "AnimalFollowUpMessageSide" NOT NULL,
    "body" TEXT NOT NULL,
    "letterDate" DATE NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_follow_up_message_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_follow_up_animalId_date_idx" ON "animal_follow_up"("animalId", "date");

-- CreateIndex
CREATE INDEX "animal_follow_up_shelterId_status_idx" ON "animal_follow_up"("shelterId", "status");

-- CreateIndex
CREATE INDEX "animal_follow_up_message_followUpId_createdAt_idx" ON "animal_follow_up_message"("followUpId", "createdAt");

-- AddForeignKey
ALTER TABLE "animal_follow_up" ADD CONSTRAINT "animal_follow_up_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_follow_up" ADD CONSTRAINT "animal_follow_up_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_follow_up_message" ADD CONSTRAINT "animal_follow_up_message_followUpId_fkey" FOREIGN KEY ("followUpId") REFERENCES "animal_follow_up"("id") ON DELETE CASCADE ON UPDATE CASCADE;
