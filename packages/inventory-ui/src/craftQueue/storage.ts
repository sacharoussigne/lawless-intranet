import type { CraftQueueEntry } from './plan';

/** What is kept per dispensary in this browser. */
export type StoredCraftQueue = { entries: CraftQueueEntry[] };

export const EMPTY_CRAFT_QUEUE: StoredCraftQueue = { entries: [] };

export function craftQueueStorageKey(scopeKey: string): string {
  return `craft.queue.v2:${scopeKey}`;
}

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

function parseEntry(value: unknown): CraftQueueEntry | null {
  if (typeof value !== 'object' || value === null) return null;
  const { id, craftedItemId, recipeId, times, sourceChestId, destinationChestId } = value as Record<string, unknown>;
  if (!isString(id) || !isString(craftedItemId) || !isString(recipeId)) return null;
  if (!isString(sourceChestId) || !isString(destinationChestId)) return null;
  if (typeof times !== 'number' || !Number.isInteger(times) || times < 1) return null;
  return { id, craftedItemId, recipeId, times, sourceChestId, destinationChestId };
}

/** Validates a stored value (localStorage can hold anything): invalid entries are dropped. */
export function parseStoredCraftQueue(raw: string | null): StoredCraftQueue {
  if (!raw) return EMPTY_CRAFT_QUEUE;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return EMPTY_CRAFT_QUEUE;
  }
  if (typeof value !== 'object' || value === null) return EMPTY_CRAFT_QUEUE;
  const { entries } = value as Record<string, unknown>;
  return {
    entries: Array.isArray(entries)
      ? entries.map(parseEntry).filter((entry): entry is CraftQueueEntry => entry !== null)
      : [],
  };
}

export function newCraftQueueEntryId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
