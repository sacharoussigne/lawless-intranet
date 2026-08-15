-- CreateEnum
CREATE TYPE "MemberPermissionEffect" AS ENUM ('GRANT', 'DENY');

-- CreateTable
CREATE TABLE "shelter" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,

    CONSTRAINT "shelter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter_member" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shelter_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter_role_permission" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shelter_role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelter_member_permission" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "effect" "MemberPermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shelter_member_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_settings" (
    "shelterId" TEXT NOT NULL,
    "shelterName" TEXT NOT NULL DEFAULT 'Refuge',
    "featureBankEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "app_settings_pkey" PRIMARY KEY ("shelterId")
);

-- CreateIndex
CREATE UNIQUE INDEX "shelter_slug_key" ON "shelter"("slug");

-- CreateIndex
CREATE INDEX "shelter_createdById_idx" ON "shelter"("createdById");

-- CreateIndex
CREATE INDEX "shelter_member_userId_idx" ON "shelter_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "shelter_member_shelterId_userId_key" ON "shelter_member"("shelterId", "userId");

-- CreateIndex
CREATE INDEX "shelter_role_permission_shelterId_role_idx" ON "shelter_role_permission"("shelterId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "shelter_role_permission_shelterId_role_resource_action_key" ON "shelter_role_permission"("shelterId", "role", "resource", "action");

-- CreateIndex
CREATE INDEX "shelter_member_permission_memberId_idx" ON "shelter_member_permission"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "shelter_member_permission_memberId_resource_action_key" ON "shelter_member_permission"("memberId", "resource", "action");

-- AddForeignKey
ALTER TABLE "shelter_member" ADD CONSTRAINT "shelter_member_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter_role_permission" ADD CONSTRAINT "shelter_role_permission_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelter_member_permission" ADD CONSTRAINT "shelter_member_permission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "shelter_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "app_settings" ADD CONSTRAINT "app_settings_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
