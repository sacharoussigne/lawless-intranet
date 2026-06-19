-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('READ', 'WRITE');

-- CreateTable
CREATE TABLE "template" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "ownerId" TEXT,
    "createdById" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "template_access" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessType" "AccessType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "template_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "scopeId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_access" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessType" "AccessType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "document_access_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "template_type_scopeId_idx" ON "template"("type", "scopeId");

-- CreateIndex
CREATE INDEX "template_ownerId_idx" ON "template"("ownerId");

-- CreateIndex
CREATE INDEX "template_createdById_idx" ON "template"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "template_access_templateId_userId_key" ON "template_access"("templateId", "userId");

-- CreateIndex
CREATE INDEX "template_access_userId_idx" ON "template_access"("userId");

-- CreateIndex
CREATE INDEX "document_type_scopeId_idx" ON "document"("type", "scopeId");

-- CreateIndex
CREATE INDEX "document_ownerId_idx" ON "document"("ownerId");

-- CreateIndex
CREATE INDEX "document_createdAt_idx" ON "document"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "document_access_documentId_userId_key" ON "document_access"("documentId", "userId");

-- CreateIndex
CREATE INDEX "document_access_userId_idx" ON "document_access"("userId");

-- AddForeignKey
ALTER TABLE "template_access" ADD CONSTRAINT "template_access_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "template"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_access" ADD CONSTRAINT "document_access_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
