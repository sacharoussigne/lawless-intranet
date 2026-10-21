-- CreateEnum
CREATE TYPE "MemberPermissionEffect" AS ENUM ('GRANT', 'DENY');

-- CreateTable
CREATE TABLE "dispensary_role_permission" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispensary_role_permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dispensary_member_permission" (
    "id" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "effect" "MemberPermissionEffect" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dispensary_member_permission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "dispensary_role_permission_dispensaryId_role_idx" ON "dispensary_role_permission"("dispensaryId", "role");

-- CreateIndex
CREATE UNIQUE INDEX "dispensary_role_permission_dispensaryId_role_resource_actio_key" ON "dispensary_role_permission"("dispensaryId", "role", "resource", "action");

-- CreateIndex
CREATE INDEX "dispensary_member_permission_memberId_idx" ON "dispensary_member_permission"("memberId");

-- CreateIndex
CREATE UNIQUE INDEX "dispensary_member_permission_memberId_resource_action_key" ON "dispensary_member_permission"("memberId", "resource", "action");

-- AddForeignKey
ALTER TABLE "dispensary_role_permission" ADD CONSTRAINT "dispensary_role_permission_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dispensary_member_permission" ADD CONSTRAINT "dispensary_member_permission_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "dispensary_member"("id") ON DELETE CASCADE ON UPDATE CASCADE;
