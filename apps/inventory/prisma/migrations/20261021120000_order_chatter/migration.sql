-- Orders: automatic price, author and responsible, chatter (order_event).
-- CreateEnum
CREATE TYPE "OrderEventKind" AS ENUM ('COMMENT', 'CREATED', 'UPDATED', 'COMPLETED', 'DUPLICATED');

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "createdByUserId" TEXT,
ADD COLUMN     "priceManual" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "responsibleUserId" TEXT;

-- CreateTable
CREATE TABLE "order_event" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "kind" "OrderEventKind" NOT NULL,
    "actorUserId" TEXT,
    "body" TEXT,
    "changes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3),

    CONSTRAINT "order_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_event_orderId_createdAt_idx" ON "order_event"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "order_scopeType_scopeId_responsibleUserId_idx" ON "order"("scopeType", "scopeId", "responsibleUserId");

-- AddForeignKey
ALTER TABLE "order_event" ADD CONSTRAINT "order_event_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "order"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Editable orders whose stored price differs from the catalog total were priced by hand:
-- they keep their price. The others follow their items from now on.
UPDATE "order" o
SET "priceManual" = true
WHERE o."status" <> 'COMPLETED'
  AND o."price" IS NOT NULL
  AND o."price" IS DISTINCT FROM (
    SELECT NULLIF(SUM(i."price" * oi."quantity") FILTER (WHERE i."price" > 0), 0)
    FROM "order_item" oi
    JOIN "item" i ON i."id" = oi."itemId"
    WHERE oi."orderId" = o."id"
  );
