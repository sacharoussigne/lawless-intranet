-- « Close by meaning » search of letters (lib/letters/embeddings.ts).
-- Needs pgvector on the server (image pgvector/pgvector, or the postgresql-XX-pgvector package): see docs/LETTERS.md.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "letter" ADD COLUMN "embedding" vector(384);
ALTER TABLE "letter" ADD COLUMN "embedding_model" TEXT;

CREATE INDEX "letter_embedding_idx" ON "letter" USING hnsw ("embedding" vector_cosine_ops);

-- Search text starts with the serial without its dash (« gm576yyf »): found when typed without the dash.
UPDATE "letter"
SET "search_text" = regexp_replace(lower("serial"), '[^a-z0-9]', '', 'g') || E'\n' || "search_text";
