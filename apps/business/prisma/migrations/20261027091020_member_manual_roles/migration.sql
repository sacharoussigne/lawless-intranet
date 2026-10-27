-- AlterTable
ALTER TABLE "dispensary_member" ADD COLUMN     "manualRoles" TEXT NOT NULL DEFAULT '';

-- Existing roles were all given by hand: keep them as manual roles.
UPDATE "dispensary_member" SET "manualRoles" = "role";
