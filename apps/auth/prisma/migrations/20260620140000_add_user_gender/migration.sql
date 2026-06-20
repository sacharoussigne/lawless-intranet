-- CreateEnum
CREATE TYPE "UserGender" AS ENUM ('male', 'female');

-- AlterTable
ALTER TABLE "user" ADD COLUMN "gender" "UserGender" NOT NULL DEFAULT 'male';
