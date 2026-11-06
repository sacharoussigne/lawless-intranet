import { after } from 'next/server';
import prisma from '@/lib/prisma';
import {
  LETTER_EMBEDDING_MODEL,
  letterEmbeddingPassage,
  letterEmbeddingQuery,
  pickSemanticMatches,
  toVectorLiteral,
} from './semantic';

/**
 * « Close by meaning » search of letters: a local multilingual model (transformers.js, nothing leaves
 * the server) turns text into vectors stored with pgvector. Server only. Everything here is best effort:
 * on any failure the plain text search still answers.
 */

type Extractor = (
  texts: string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ tolist: () => number[][] }>;

let extractorPromise: Promise<Extractor> | null = null;

export function semanticSearchEnabled(): boolean {
  return process.env.LETTERS_SEMANTIC_SEARCH !== 'false';
}

/** The model, loaded once per process (downloaded on first use into LETTERS_EMBEDDINGS_CACHE_DIR). */
function loadExtractor(): Promise<Extractor> {
  extractorPromise ??= (async () => {
    const { pipeline, env } = await import('@huggingface/transformers');
    if (process.env.LETTERS_EMBEDDINGS_CACHE_DIR) env.cacheDir = process.env.LETTERS_EMBEDDINGS_CACHE_DIR;
    return (await pipeline('feature-extraction', LETTER_EMBEDDING_MODEL, { dtype: 'q8' })) as unknown as Extractor;
  })().catch((error: unknown) => {
    extractorPromise = null;
    throw error;
  });
  return extractorPromise;
}

async function embed(texts: string[]): Promise<number[][]> {
  const extractor = await loadExtractor();
  const output = await extractor(texts, { pooling: 'mean', normalize: true });
  return output.tolist();
}

const FILL_BATCH = 32;

/** Computes the missing (or outdated) vectors of a box, a batch at a time. Returns how many were written. */
async function fillMissingEmbeddings(boxId: string): Promise<number> {
  const letters = await prisma.letter.findMany({
    where: { boxId, OR: [{ embeddingModel: null }, { embeddingModel: { not: LETTER_EMBEDDING_MODEL } }] },
    select: { id: true, title: true, transcript: true, correspondent: { select: { name: true } } },
    take: FILL_BATCH,
  });
  if (letters.length === 0) return 0;
  const vectors = await embed(
    letters.map((letter) =>
      letterEmbeddingPassage({ title: letter.title, transcript: letter.transcript, correspondentName: letter.correspondent.name }),
    ),
  );
  for (const [index, letter] of letters.entries()) {
    await prisma.$executeRaw`
      UPDATE "letter"
      SET "embedding" = ${toVectorLiteral(vectors[index])}::vector, "embedding_model" = ${LETTER_EMBEDDING_MODEL}
      WHERE "id" = ${letter.id}`;
  }
  return letters.length;
}

/**
 * After a write (letter added or edited, contact renamed): marks the letters to embed again and
 * computes the box's missing vectors after the response. Never awaited, never throws.
 */
export function scheduleLetterEmbeddings(boxId: string, staleLetters?: { letterIds?: string[]; correspondentId?: string }): void {
  if (!semanticSearchEnabled()) return;
  after(async () => {
    try {
      if (staleLetters?.letterIds?.length || staleLetters?.correspondentId) {
        await prisma.letter.updateMany({
          where: {
            boxId,
            OR: [
              ...(staleLetters.letterIds?.length ? [{ id: { in: staleLetters.letterIds } }] : []),
              ...(staleLetters.correspondentId ? [{ correspondentId: staleLetters.correspondentId }] : []),
            ],
          },
          data: { embeddingModel: null },
        });
      }
      while ((await fillMissingEmbeddings(boxId)) === FILL_BATCH) {
        // Next batch.
      }
    } catch (error) {
      console.error('Letters: embeddings not computed', error);
    }
  });
}

const SEMANTIC_TIMEOUT_MS = 2000;
const NEIGHBOURS = 20;

/**
 * Letters of the box closest by meaning to the query, best first, already-found ones excluded.
 * Empty when disabled, slow (model still loading) or failing.
 */
export async function findSimilarLetterIds(
  boxId: string,
  query: string,
  options: { includeArchived: boolean; excludeIds: string[]; limit: number },
): Promise<string[]> {
  if (!semanticSearchEnabled()) return [];
  const search = async () => {
    const [vector] = await embed([letterEmbeddingQuery(query)]);
    const literal = toVectorLiteral(vector);
    const rows = await prisma.$queryRaw<{ id: string; score: number }[]>`
      SELECT "id", (1 - ("embedding" <=> ${literal}::vector))::float8 AS "score"
      FROM "letter"
      WHERE "boxId" = ${boxId}
        AND "embedding" IS NOT NULL
        AND (${options.includeArchived} OR "archivedAt" IS NULL)
      ORDER BY "embedding" <=> ${literal}::vector
      LIMIT ${NEIGHBOURS}`;
    const excluded = new Set(options.excludeIds);
    return pickSemanticMatches(rows, NEIGHBOURS)
      .filter((row) => !excluded.has(row.id))
      .slice(0, options.limit)
      .map((row) => row.id);
  };
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      search(),
      new Promise<string[]>((resolve) => {
        timer = setTimeout(() => resolve([]), SEMANTIC_TIMEOUT_MS);
      }),
    ]);
  } catch (error) {
    console.error('Letters: meaning search failed', error);
    return [];
  } finally {
    clearTimeout(timer);
  }
}
