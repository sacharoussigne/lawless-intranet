/** Pure helpers of the « close by meaning » search (the model itself is in embeddings.ts). */

/** Model of the stored vectors: a letter embedded by another model is embedded again. */
export const LETTER_EMBEDDING_MODEL = 'Xenova/multilingual-e5-small';
export const LETTER_EMBEDDING_DIMENSIONS = 384;

const MAX_PASSAGE_LENGTH = 2000;

/** Text of a letter given to the model (e5 wants the « passage: » prefix). */
export function letterEmbeddingPassage(letter: {
  title: string;
  correspondentName: string;
  transcript: string | null;
}): string {
  const text = [letter.title, letter.correspondentName, letter.transcript?.trim()].filter(Boolean).join('\n');
  return `passage: ${text.slice(0, MAX_PASSAGE_LENGTH)}`;
}

/** Typed search given to the model (e5 wants the « query: » prefix). */
export function letterEmbeddingQuery(query: string): string {
  return `query: ${query.trim()}`;
}

/** pgvector literal (« [0.1,0.2,…] »), passed as a bound parameter then cast with ::vector. */
export function toVectorLiteral(vector: readonly number[]): string {
  if (vector.length !== LETTER_EMBEDDING_DIMENSIONS || !vector.every(Number.isFinite)) {
    throw new Error('Vecteur de lettre invalide');
  }
  return `[${vector.join(',')}]`;
}

/**
 * e5 scores are packed (≈ 0.78–0.86): keep neighbours above a floor and close to the best one,
 * so a vague search shows a few letters, not the whole box.
 */
export const SEMANTIC_MIN_SCORE = 0.8;
export const SEMANTIC_MAX_GAP = 0.03;

export function pickSemanticMatches<T extends { score: number }>(rows: T[], limit: number): T[] {
  const sorted = [...rows].sort((a, b) => b.score - a.score);
  const best = sorted[0]?.score ?? 0;
  return sorted.filter((row) => row.score >= SEMANTIC_MIN_SCORE && row.score >= best - SEMANTIC_MAX_GAP).slice(0, limit);
}

/** Search queries worth a meaning search: a few letters, not a serial. */
export function wantsSemanticSearch(query: string, isSerial: boolean): boolean {
  return !isSerial && query.trim().length >= 4;
}
