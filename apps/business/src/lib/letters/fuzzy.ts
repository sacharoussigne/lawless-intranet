import { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { normalizeLetterSearch } from './search';

/**
 * Typo-tolerant word search (pg_trgm): « oiseau » finds « oieau », « montgomeri » finds « Montgomery ».
 * Compares the normalized query with the words of `search_text` (and the contact's `search_name`).
 * Server only; scans the letters of one box, a few milliseconds.
 */

/** word_similarity floor: « oiseau » ~ « oieau » is 0.44, unrelated words stay under 0.3. */
export const FUZZY_MIN_SIMILARITY = 0.4;
export const FUZZY_MIN_LENGTH = 3;

export function wantsFuzzySearch(query: string): boolean {
  return normalizeLetterSearch(query.trim()).length >= FUZZY_MIN_LENGTH;
}

/** Letters whose words are close to the query, closest first. */
export async function findFuzzyLetterIds(
  boxId: string,
  query: string,
  options: { correspondentId?: string; includeArchived: boolean; excludeIds?: string[]; limit: number },
): Promise<string[]> {
  if (!wantsFuzzySearch(query)) return [];
  const needle = normalizeLetterSearch(query.trim());
  const excluded = options.excludeIds?.length ? options.excludeIds : null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT l."id"
    FROM "letter" l
    JOIN "letter_correspondent" c ON c."id" = l."correspondentId"
    WHERE l."boxId" = ${boxId}
      AND (${options.correspondentId ?? null}::text IS NULL OR l."correspondentId" = ${options.correspondentId ?? null})
      AND (${options.includeArchived} OR l."archivedAt" IS NULL)
      ${excluded ? Prisma.sql`AND l."id" NOT IN (${Prisma.join(excluded)})` : Prisma.empty}
      AND GREATEST(word_similarity(${needle}, l."search_text"), word_similarity(${needle}, c."search_name")) >= ${FUZZY_MIN_SIMILARITY}
    ORDER BY GREATEST(word_similarity(${needle}, l."search_text"), word_similarity(${needle}, c."search_name")) DESC,
      l."letterDate" DESC
    LIMIT ${options.limit}`;
  return rows.map((row) => row.id);
}

/** Contacts of the box whose name is close to the query, closest first. */
export async function findFuzzyCorrespondentIds(
  boxId: string,
  query: string,
  options: { excludeIds?: string[]; limit: number },
): Promise<string[]> {
  if (!wantsFuzzySearch(query)) return [];
  const needle = normalizeLetterSearch(query.trim());
  const excluded = options.excludeIds?.length ? options.excludeIds : null;
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    SELECT "id"
    FROM "letter_correspondent"
    WHERE "boxId" = ${boxId}
      ${excluded ? Prisma.sql`AND "id" NOT IN (${Prisma.join(excluded)})` : Prisma.empty}
      AND word_similarity(${needle}, "search_name") >= ${FUZZY_MIN_SIMILARITY}
    ORDER BY word_similarity(${needle}, "search_name") DESC
    LIMIT ${options.limit}`;
  return rows.map((row) => row.id);
}
