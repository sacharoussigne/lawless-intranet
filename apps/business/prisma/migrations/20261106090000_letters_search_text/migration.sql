-- Accent-insensitive search of letters: normalized copies of the searched text (normalizeLetterSearch).
ALTER TABLE "letter_correspondent" ADD COLUMN "search_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "letter" ADD COLUMN "search_text" TEXT NOT NULL DEFAULT '';

-- Backfill: lowercase, French accents removed, œ / æ spelled out.
UPDATE "letter_correspondent"
SET "search_name" = replace(replace(translate(lower("name"),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), 'œ', 'oe'), 'æ', 'ae');

UPDATE "letter"
SET "search_text" = replace(replace(translate(lower(
  CASE WHEN coalesce(btrim("transcript"), '') = '' THEN "title" ELSE "title" || E'\n' || btrim("transcript") END),
  'àáâãäåçèéêëìíîïñòóôõöùúûüýÿ', 'aaaaaaceeeeiiiinooooouuuuyy'), 'œ', 'oe'), 'æ', 'ae');
