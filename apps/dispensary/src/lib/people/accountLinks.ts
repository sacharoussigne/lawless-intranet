import type { PrismaClient } from '@prisma/client';
import {
  resolveDiscordIdsForUserIds,
  resolveUsersByDiscordIds,
} from '@lawless-intranet/auth-client/internal';

/**
 * Link between an intranet account and a Discord id. The person is the Discord
 * id: `userId` on profiles and activity rows is only a cache of the account that
 * holds it today, never a source of rights.
 *
 * Lookups go to the auth service and are cached a few minutes, "no account"
 * included (people without an account would otherwise be looked up on every
 * list). A failed lookup returns `undefined` ("unknown"), which callers must
 * not confuse with `null` ("no account").
 */

type Account = { userId: string; name: string };

const FOUND_TTL_MS = 5 * 60 * 1000;
const MISSING_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 1_000;

type Entry<T> = { value: T; expiresAt: number };

function createCache<T>() {
  const map = new Map<string, Entry<T>>();
  return {
    get(key: string): T | undefined {
      const hit = map.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= Date.now()) {
        map.delete(key);
        return undefined;
      }
      return hit.value;
    },
    has(key: string): boolean {
      return this.get(key) !== undefined;
    },
    set(key: string, value: T, found: boolean) {
      if (map.size >= MAX_ENTRIES) {
        const now = Date.now();
        for (const [k, entry] of map) if (entry.expiresAt <= now) map.delete(k);
        if (map.size >= MAX_ENTRIES) map.clear();
      }
      map.set(key, { value, expiresAt: Date.now() + (found ? FOUND_TTL_MS : MISSING_TTL_MS) });
    },
    clear() {
      map.clear();
    },
  };
}

const accountByDiscord = createCache<Account | null>();
const discordByUser = createCache<string | null>();

/** Tests only. */
export function clearAccountLinkCache() {
  accountByDiscord.clear();
  discordByUser.clear();
}

/** Account of each Discord id (`null`: no account), or `undefined` when auth did not answer. */
export async function lookupAccountsByDiscordIds(
  discordIds: string[],
): Promise<Map<string, Account | null> | undefined> {
  const unique = [...new Set(discordIds.filter(Boolean))];
  const result = new Map<string, Account | null>();
  const missing = unique.filter((id) => {
    const cached = accountByDiscord.get(id);
    if (cached === undefined) return true;
    result.set(id, cached);
    return false;
  });
  if (missing.length === 0) return result;

  let rows: Awaited<ReturnType<typeof resolveUsersByDiscordIds>>;
  try {
    rows = await resolveUsersByDiscordIds(missing);
  } catch {
    return undefined;
  }
  const found = new Map(rows.map((row) => [row.discordId, { userId: row.userId, name: row.name }]));
  for (const id of missing) {
    const account = found.get(id) ?? null;
    accountByDiscord.set(id, account, account !== null);
    result.set(id, account);
  }
  return result;
}

/** Discord id of each account (`null`: no Discord), or `undefined` when auth did not answer. */
export async function lookupDiscordIdsByUserIds(
  userIds: string[],
): Promise<Map<string, string | null> | undefined> {
  const unique = [...new Set(userIds.filter(Boolean))];
  const result = new Map<string, string | null>();
  const missing = unique.filter((id) => {
    const cached = discordByUser.get(id);
    if (cached === undefined) return true;
    result.set(id, cached);
    return false;
  });
  if (missing.length === 0) return result;

  let found: Map<string, string>;
  try {
    found = await resolveDiscordIdsForUserIds(missing);
  } catch {
    return undefined;
  }
  for (const id of missing) {
    const discordId = found.get(id) ?? null;
    discordByUser.set(id, discordId, discordId !== null);
    result.set(id, discordId);
  }
  return result;
}

/** Current Discord id of an account; `null` when it has none or when auth did not answer. */
export async function discordIdOfUser(userId: string | null | undefined): Promise<string | null> {
  return (await lookupDiscordIdOfUser(userId)) ?? null;
}

/**
 * Current Discord id of an account: `null` for no Discord, `undefined` when
 * auth did not answer (callers may then fall back on the stored `userId`).
 */
export async function lookupDiscordIdOfUser(
  userId: string | null | undefined,
): Promise<string | null | undefined> {
  if (!userId) return null;
  const found = await lookupDiscordIdsByUserIds([userId]);
  if (!found) return undefined;
  return found.get(userId) ?? null;
}

/**
 * Current account of a Discord id: `null` for no account, `undefined` when
 * auth did not answer (keep what is stored).
 */
export async function accountIdOfDiscord(discordUserId: string): Promise<string | null | undefined> {
  const accounts = await lookupAccountsByDiscordIds([discordUserId]);
  if (!accounts) return undefined;
  return accounts.get(discordUserId)?.userId ?? null;
}

type LinkDb = Pick<PrismaClient, 'dispensaryDiscordProfile' | 'dispensaryWeeklyActivity'>;

/**
 * Brings `userId` up to date on the profiles and activity rows of these Discord
 * ids: links an account created after the person was added, unlinks an account
 * that no longer holds the Discord id, follows a Discord moved to another
 * account. Best effort: nothing changes when auth does not answer.
 */
export async function reconcileAccountLinks(
  client: LinkDb,
  dispensaryId: string,
  discordIds: string[],
): Promise<Map<string, string | null> | undefined> {
  const accounts = await lookupAccountsByDiscordIds(discordIds);
  if (!accounts || accounts.size === 0) return undefined;
  const userIdByDiscord = new Map([...accounts].map(([id, account]) => [id, account?.userId ?? null]));

  await Promise.all(
    [...userIdByDiscord].flatMap(([discordUserId, userId]) => {
      // Rows whose link differs (SQL `<>` never matches NULL, hence the explicit OR).
      const stale =
        userId === null
          ? { userId: { not: null } }
          : { OR: [{ userId: null }, { userId: { not: userId } }] };
      const where = { dispensaryId, discordUserId, ...stale };
      return [
        client.dispensaryDiscordProfile.updateMany({ where, data: { userId } }),
        client.dispensaryWeeklyActivity.updateMany({ where, data: { userId } }),
      ];
    }),
  );
  return userIdByDiscord;
}
