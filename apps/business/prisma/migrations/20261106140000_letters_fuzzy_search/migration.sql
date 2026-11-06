-- Typo-tolerant word search of letters (lib/letters/fuzzy.ts): word_similarity on the normalized
-- search columns. pg_trgm ships with PostgreSQL (contrib) and is a trusted extension.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Search text starts with the serial without its dash (« gm576yyf »): found when typed without the dash.
UPDATE "letter"
SET "search_text" = regexp_replace(lower("serial"), '[^a-z0-9]', '', 'g') || E'\n' || "search_text";
