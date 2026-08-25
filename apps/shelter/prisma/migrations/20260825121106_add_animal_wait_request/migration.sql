-- CreateEnum
CREATE TYPE "AnimalWaitRequestStatus" AS ENUM ('open', 'fulfilled', 'cancelled');

-- CreateTable
CREATE TABLE "animal_wait_request" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "requestedAt" DATE NOT NULL,
    "requesterName" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT,
    "comment" TEXT,
    "status" "AnimalWaitRequestStatus" NOT NULL DEFAULT 'open',
    "fulfilledAnimalId" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_wait_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_wait_request_shelterId_status_requestedAt_idx" ON "animal_wait_request"("shelterId", "status", "requestedAt");

-- AddForeignKey
ALTER TABLE "animal_wait_request" ADD CONSTRAINT "animal_wait_request_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_wait_request" ADD CONSTRAINT "animal_wait_request_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "animal_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_wait_request" ADD CONSTRAINT "animal_wait_request_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "animal_breed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_wait_request" ADD CONSTRAINT "animal_wait_request_fulfilledAnimalId_fkey" FOREIGN KEY ("fulfilledAnimalId") REFERENCES "animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
