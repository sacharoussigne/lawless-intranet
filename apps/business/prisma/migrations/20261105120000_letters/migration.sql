-- CreateEnum
CREATE TYPE "LetterBoxAccessLevel" AS ENUM ('OWNER', 'WRITE', 'READ');

-- CreateEnum
CREATE TYPE "LetterDirection" AS ENUM ('RECEIVED', 'SENT');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN     "featureLettersEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "letter_box" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_box_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_box_member" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" "LetterBoxAccessLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_box_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_correspondent" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "note" TEXT,
    "lastLetterAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_correspondent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter" (
    "id" TEXT NOT NULL,
    "boxId" TEXT NOT NULL,
    "correspondentId" TEXT NOT NULL,
    "direction" "LetterDirection" NOT NULL,
    "serial" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "transcript" TEXT,
    "letterDate" TIMESTAMP(3) NOT NULL,
    "replyToId" TEXT,
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "letter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "letter_image" (
    "id" TEXT NOT NULL,
    "letterId" TEXT NOT NULL,
    "mediaFileId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "letter_image_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "letter_box_businessId_idx" ON "letter_box"("businessId");

-- CreateIndex
CREATE INDEX "letter_box_member_userId_idx" ON "letter_box_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "letter_box_member_boxId_userId_key" ON "letter_box_member"("boxId", "userId");

-- CreateIndex
CREATE INDEX "letter_correspondent_boxId_lastLetterAt_idx" ON "letter_correspondent"("boxId", "lastLetterAt");

-- CreateIndex
CREATE INDEX "letter_correspondentId_letterDate_idx" ON "letter"("correspondentId", "letterDate");

-- CreateIndex
CREATE INDEX "letter_boxId_archivedAt_idx" ON "letter"("boxId", "archivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "letter_boxId_serial_key" ON "letter"("boxId", "serial");

-- CreateIndex
CREATE UNIQUE INDEX "letter_image_mediaFileId_key" ON "letter_image"("mediaFileId");

-- CreateIndex
CREATE INDEX "letter_image_letterId_position_idx" ON "letter_image"("letterId", "position");

-- AddForeignKey
ALTER TABLE "letter_box" ADD CONSTRAINT "letter_box_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_box_member" ADD CONSTRAINT "letter_box_member_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "letter_box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_correspondent" ADD CONSTRAINT "letter_correspondent_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "letter_box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter" ADD CONSTRAINT "letter_boxId_fkey" FOREIGN KEY ("boxId") REFERENCES "letter_box"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter" ADD CONSTRAINT "letter_correspondentId_fkey" FOREIGN KEY ("correspondentId") REFERENCES "letter_correspondent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter" ADD CONSTRAINT "letter_replyToId_fkey" FOREIGN KEY ("replyToId") REFERENCES "letter"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "letter_image" ADD CONSTRAINT "letter_image_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "letter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

