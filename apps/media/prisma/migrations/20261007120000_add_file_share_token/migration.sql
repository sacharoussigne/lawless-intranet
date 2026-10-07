-- AlterTable
ALTER TABLE "media_file" ADD COLUMN     "shareToken" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "media_file_shareToken_key" ON "media_file"("shareToken");
