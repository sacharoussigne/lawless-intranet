-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "MediaFileStatus" AS ENUM ('UPLOADING', 'READY');

-- CreateTable
CREATE TABLE "media_folder" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_folder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_file" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "status" "MediaFileStatus" NOT NULL DEFAULT 'UPLOADING',
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_file_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_folder_scopeType_scopeId_parentId_idx" ON "media_folder"("scopeType", "scopeId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "media_file_storageKey_key" ON "media_file"("storageKey");

-- CreateIndex
CREATE INDEX "media_file_scopeType_scopeId_folderId_status_idx" ON "media_file"("scopeType", "scopeId", "folderId", "status");

-- AddForeignKey
ALTER TABLE "media_folder" ADD CONSTRAINT "media_folder_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "media_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "media_file" ADD CONSTRAINT "media_file_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

