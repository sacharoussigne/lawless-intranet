-- Rename subspecies -> breed
ALTER TABLE "animal_species_variant" DROP CONSTRAINT IF EXISTS "animal_species_variant_subspeciesId_fkey";
DROP INDEX IF EXISTS "animal_species_variant_subspeciesId_sortOrder_idx";
DROP INDEX IF EXISTS "animal_species_variant_subspeciesId_label_key";

ALTER TABLE "animal_subspecies" RENAME TO "animal_breed";
ALTER INDEX IF EXISTS "animal_subspecies_pkey" RENAME TO "animal_breed_pkey";
ALTER INDEX IF EXISTS "animal_subspecies_speciesId_sortOrder_idx" RENAME TO "animal_breed_speciesId_sortOrder_idx";
ALTER INDEX IF EXISTS "animal_subspecies_speciesId_name_key" RENAME TO "animal_breed_speciesId_name_key";
ALTER TABLE "animal_breed" RENAME CONSTRAINT "animal_subspecies_speciesId_fkey" TO "animal_breed_speciesId_fkey";

ALTER TABLE "animal_species_variant" RENAME COLUMN "subspeciesId" TO "breedId";
CREATE INDEX "animal_species_variant_breedId_sortOrder_idx" ON "animal_species_variant"("breedId", "sortOrder");
CREATE UNIQUE INDEX "animal_species_variant_breedId_label_key" ON "animal_species_variant"("breedId", "label");
ALTER TABLE "animal_species_variant" ADD CONSTRAINT "animal_species_variant_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "animal_breed"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Animal status enum
CREATE TYPE "AnimalStatus" AS ENUM ('in_care', 'awaiting_adoption', 'adopted', 'deceased');
CREATE TYPE "AnimalHistoryAction" AS ENUM ('create', 'update', 'delete');

-- Animal table
CREATE TABLE "animal" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "breedId" TEXT NOT NULL,
    "variantId" TEXT,
    "arrivalDate" DATE NOT NULL,
    "adoptionPrice" DECIMAL(10,2) NOT NULL,
    "caseManagerUserId" TEXT NOT NULL,
    "status" "AnimalStatus" NOT NULL DEFAULT 'awaiting_adoption',
    "biography" TEXT,
    "careProvided" TEXT,
    "notes" TEXT,
    "adopterName" TEXT,
    "departureDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "animal_shelterId_status_idx" ON "animal"("shelterId", "status");
CREATE INDEX "animal_shelterId_name_idx" ON "animal"("shelterId", "name");

ALTER TABLE "animal" ADD CONSTRAINT "animal_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "animal" ADD CONSTRAINT "animal_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "animal_species"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal" ADD CONSTRAINT "animal_breedId_fkey" FOREIGN KEY ("breedId") REFERENCES "animal_breed"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "animal" ADD CONSTRAINT "animal_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "animal_species_variant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Animal history
CREATE TABLE "animal_history" (
    "id" TEXT NOT NULL,
    "animalId" TEXT,
    "shelterId" TEXT NOT NULL,
    "action" "AnimalHistoryAction" NOT NULL,
    "actorUserId" TEXT,
    "previousValues" JSONB,
    "nextValues" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "animal_history_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "animal_history_shelterId_createdAt_idx" ON "animal_history"("shelterId", "createdAt");
CREATE INDEX "animal_history_animalId_createdAt_idx" ON "animal_history"("animalId", "createdAt");

ALTER TABLE "animal_history" ADD CONSTRAINT "animal_history_animalId_fkey" FOREIGN KEY ("animalId") REFERENCES "animal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "animal_history" ADD CONSTRAINT "animal_history_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;
