-- CreateTable
CREATE TABLE "role_chest_access" (
    "id" TEXT NOT NULL,
    "dispensaryId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "allChests" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "role_chest_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_chest_access_chest" (
    "id" TEXT NOT NULL,
    "accessId" TEXT NOT NULL,
    "chestId" TEXT NOT NULL,

    CONSTRAINT "role_chest_access_chest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "role_chest_access_dispensaryId_idx" ON "role_chest_access"("dispensaryId");

-- CreateIndex
CREATE UNIQUE INDEX "role_chest_access_dispensaryId_role_key" ON "role_chest_access"("dispensaryId", "role");

-- CreateIndex
CREATE INDEX "role_chest_access_chest_accessId_idx" ON "role_chest_access_chest"("accessId");

-- CreateIndex
CREATE INDEX "role_chest_access_chest_chestId_idx" ON "role_chest_access_chest"("chestId");

-- CreateIndex
CREATE UNIQUE INDEX "role_chest_access_chest_accessId_chestId_key" ON "role_chest_access_chest"("accessId", "chestId");

-- AddForeignKey
ALTER TABLE "role_chest_access" ADD CONSTRAINT "role_chest_access_dispensaryId_fkey" FOREIGN KEY ("dispensaryId") REFERENCES "dispensary"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_chest_access_chest" ADD CONSTRAINT "role_chest_access_chest_accessId_fkey" FOREIGN KEY ("accessId") REFERENCES "role_chest_access"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_chest_access_chest" ADD CONSTRAINT "role_chest_access_chest_chestId_fkey" FOREIGN KEY ("chestId") REFERENCES "chest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
