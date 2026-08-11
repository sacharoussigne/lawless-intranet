-- Recreate variants attached to subspecies instead of species
DROP TABLE IF EXISTS "animal_species_variant";

CREATE TABLE "animal_species_variant" (
    "id" TEXT NOT NULL,
    "subspeciesId" TEXT NOT NULL,
    "label" VARCHAR(255) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "animal_species_variant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "animal_species_variant_subspeciesId_sortOrder_idx" ON "animal_species_variant"("subspeciesId", "sortOrder");

CREATE UNIQUE INDEX "animal_species_variant_subspeciesId_label_key" ON "animal_species_variant"("subspeciesId", "label");

ALTER TABLE "animal_species_variant" ADD CONSTRAINT "animal_species_variant_subspeciesId_fkey" FOREIGN KEY ("subspeciesId") REFERENCES "animal_subspecies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
