-- CreateTable
CREATE TABLE "animal_species" (
    "id" TEXT NOT NULL,
    "shelterId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_species_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_subspecies" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_subspecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "animal_species_variant" (
    "id" TEXT NOT NULL,
    "speciesId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_species_variant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "animal_species_shelterId_sortOrder_idx" ON "animal_species"("shelterId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "animal_species_shelterId_name_key" ON "animal_species"("shelterId", "name");

-- CreateIndex
CREATE INDEX "animal_subspecies_speciesId_sortOrder_idx" ON "animal_subspecies"("speciesId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "animal_subspecies_speciesId_name_key" ON "animal_subspecies"("speciesId", "name");

-- CreateIndex
CREATE INDEX "animal_species_variant_speciesId_sortOrder_idx" ON "animal_species_variant"("speciesId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "animal_species_variant_speciesId_label_key" ON "animal_species_variant"("speciesId", "label");

-- AddForeignKey
ALTER TABLE "animal_species" ADD CONSTRAINT "animal_species_shelterId_fkey" FOREIGN KEY ("shelterId") REFERENCES "shelter"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_subspecies" ADD CONSTRAINT "animal_subspecies_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "animal_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "animal_species_variant" ADD CONSTRAINT "animal_species_variant_speciesId_fkey" FOREIGN KEY ("speciesId") REFERENCES "animal_species"("id") ON DELETE CASCADE ON UPDATE CASCADE;
