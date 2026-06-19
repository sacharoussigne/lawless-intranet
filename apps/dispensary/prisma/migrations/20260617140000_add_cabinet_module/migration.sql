-- CreateEnum
CREATE TYPE "CabinetAccessLevel" AS ENUM ('OWNER', 'WRITE', 'READ');

-- AlterTable
ALTER TABLE "app_settings" ADD COLUMN "featureCabinetEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "cabinet" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "formSchemas" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_member" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessLevel" "CabinetAccessLevel" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinet_member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cabinet_patient" (
    "id" TEXT NOT NULL,
    "cabinetId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "birthDate" TIMESTAMP(3),
    "emergencyContact" TEXT,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cabinet_patient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "care_episode" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "motif" TEXT NOT NULL,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "care_episode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "consultation" (
    "id" TEXT NOT NULL,
    "careEpisodeId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "customValues" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "consultation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cabinet_dispensaryId_idx" ON "cabinet"("dispensaryId");

-- CreateIndex
CREATE INDEX "cabinet_member_userId_idx" ON "cabinet_member"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "cabinet_member_cabinetId_userId_key" ON "cabinet_member"("cabinetId", "userId");

-- CreateIndex
CREATE INDEX "cabinet_patient_cabinetId_idx" ON "cabinet_patient"("cabinetId");

-- CreateIndex
CREATE INDEX "cabinet_patient_cabinetId_lastName_firstName_idx" ON "cabinet_patient"("cabinetId", "lastName", "firstName");

-- CreateIndex
CREATE INDEX "care_episode_patientId_idx" ON "care_episode"("patientId");

-- CreateIndex
CREATE INDEX "consultation_careEpisodeId_date_idx" ON "consultation"("careEpisodeId", "date");

-- AddForeignKey
ALTER TABLE "cabinet" ADD CONSTRAINT "cabinet_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_member" ADD CONSTRAINT "cabinet_member_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cabinet_patient" ADD CONSTRAINT "cabinet_patient_cabinetId_fkey" FOREIGN KEY ("cabinetId") REFERENCES "cabinet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "care_episode" ADD CONSTRAINT "care_episode_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "cabinet_patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consultation" ADD CONSTRAINT "consultation_careEpisodeId_fkey" FOREIGN KEY ("careEpisodeId") REFERENCES "care_episode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
