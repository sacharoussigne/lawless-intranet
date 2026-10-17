import { beforeEach, describe, expect, it, vi } from 'vitest';
import { permissionKey } from '@lawless-intranet/auth-permissions';

const auth = vi.hoisted(() => ({
  resolveDiscordIdsForUserIds: vi.fn(),
  resolveUsersByDiscordIds: vi.fn(),
}));
vi.mock('@lawless-intranet/auth-client/internal', () => auth);

const { clearAccountLinkCache } = await import('@/lib/people/accountLinks');
const { isWeeklyActivityOwner, weeklyActivityWhereForViewer } = await import(
  '@/lib/dispensaryWeeklyActivity/access'
);

const DISPENSARY = 'dispensary-1';
const ME = 'user-me';
const MY_DISCORD = '284726189304512512';
const COLLEAGUE_DISCORD = '391827364519283746';

const VIEW = [permissionKey('weekly_dispensary_activity', 'view')];
const EDIT_ALL = [...VIEW, permissionKey('weekly_dispensary_activity', 'edit_all')];

type Row = { dispensaryId: string; discordUserId: string; userId: string | null };

const myRow: Row = { dispensaryId: DISPENSARY, discordUserId: MY_DISCORD, userId: ME };
const colleagueRow: Row = { dispensaryId: DISPENSARY, discordUserId: COLLEAGUE_DISCORD, userId: 'user-colleague' };
const otherDispensaryRow: Row = { dispensaryId: 'dispensary-2', discordUserId: MY_DISCORD, userId: ME };
const rows = [myRow, colleagueRow, otherDispensaryRow];

/** Evaluates the subset of Prisma `where` used here: AND, equality and `{ in }`. */
function matches(where: unknown, row: Row): boolean {
  if (typeof where !== 'object' || where === null) return true;
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'AND') return (condition as unknown[]).every((part) => matches(part, row));
    const value = row[key as keyof Row];
    if (typeof condition === 'object' && condition !== null && 'in' in condition) {
      return (condition.in as unknown[]).includes(value);
    }
    return value === condition;
  });
}

async function visibleRows(permissions: string[], filter = {}) {
  const where = await weeklyActivityWhereForViewer(DISPENSARY, ME, permissions, filter);
  return rows.filter((row) => matches(where, row));
}

beforeEach(() => {
  clearAccountLinkCache();
  auth.resolveDiscordIdsForUserIds.mockReset();
  auth.resolveUsersByDiscordIds.mockReset();
});

describe('weeklyActivityWhereForViewer', () => {
  it('shows every row of the dispensary with edit-all', async () => {
    await expect(visibleRows(EDIT_ALL)).resolves.toEqual([myRow, colleagueRow]);
    await expect(visibleRows(EDIT_ALL, { discordUserId: COLLEAGUE_DISCORD })).resolves.toEqual([colleagueRow]);
  });

  it('shows only the rows of the viewer current Discord id otherwise', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([[ME, MY_DISCORD]]));
    await expect(visibleRows(VIEW)).resolves.toEqual([myRow]);
  });

  it('never lets a requested person replace the viewer restriction', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([[ME, MY_DISCORD]]));
    await expect(visibleRows(VIEW, { discordUserId: COLLEAGUE_DISCORD })).resolves.toEqual([]);
  });

  it('shows nothing to an account without Discord', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map());
    await expect(visibleRows(VIEW)).resolves.toEqual([]);
  });

  it('falls back on the stored userId while auth does not answer', async () => {
    auth.resolveDiscordIdsForUserIds.mockRejectedValue(new Error('fetch failed'));
    await expect(visibleRows(VIEW)).resolves.toEqual([myRow]);
    await expect(visibleRows(VIEW, { discordUserId: COLLEAGUE_DISCORD })).resolves.toEqual([]);
  });
});

describe('isWeeklyActivityOwner', () => {
  it('owns the rows of the current Discord id, whatever their stored userId', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([[ME, MY_DISCORD]]));
    await expect(isWeeklyActivityOwner(null, ME, { ...myRow, userId: 'stale-user' })).resolves.toBe(true);
    await expect(isWeeklyActivityOwner(null, ME, { ...colleagueRow, userId: ME })).resolves.toBe(false);
  });

  it('falls back on the stored userId while auth does not answer', async () => {
    auth.resolveDiscordIdsForUserIds.mockRejectedValue(new Error('fetch failed'));
    await expect(isWeeklyActivityOwner(null, ME, myRow)).resolves.toBe(true);
    await expect(isWeeklyActivityOwner(null, ME, colleagueRow)).resolves.toBe(false);
  });
});
