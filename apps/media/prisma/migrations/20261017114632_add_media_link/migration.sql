-- CreateTable
CREATE TABLE "media_link" (
    "id" TEXT NOT NULL,
    "scopeType" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "folderId" TEXT,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "media_link_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "media_link_scopeType_scopeId_folderId_idx" ON "media_link"("scopeType", "scopeId", "folderId");

-- AddForeignKey
ALTER TABLE "media_link" ADD CONSTRAINT "media_link_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "media_folder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
