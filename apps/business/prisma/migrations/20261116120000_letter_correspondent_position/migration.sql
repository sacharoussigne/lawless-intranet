-- Contact list ordered by hand (shared by the box), new contacts last.
ALTER TABLE "letter_correspondent" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;

-- Existing contacts: in the order they were added.
UPDATE "letter_correspondent" c
SET "position" = r.rn
FROM (
  SELECT id, (ROW_NUMBER() OVER (PARTITION BY "boxId" ORDER BY "createdAt", id) - 1)::INTEGER AS rn
  FROM "letter_correspondent"
) r
WHERE c.id = r.id;

DROP INDEX "letter_correspondent_boxId_lastLetterAt_idx";

CREATE INDEX "letter_correspondent_boxId_position_idx" ON "letter_correspondent"("boxId", "position");
