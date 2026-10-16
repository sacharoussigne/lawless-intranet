import { beforeEach, describe, expect, it, vi } from 'vitest';

const auth = vi.hoisted(() => ({
  resolveDiscordIdsForUserIds: vi.fn(),
  resolveUsersByDiscordIds: vi.fn(),
}));
vi.mock('@lawless-intranet/auth-client/internal', () => auth);

const {
  accountIdOfDiscord,
  clearAccountLinkCache,
  discordIdOfUser,
  reconcileAccountLinks,
} = await import('@/lib/people/accountLinks');

const DISCORD = '284726189304512512';

beforeEach(() => {
  clearAccountLinkCache();
  auth.resolveUsersByDiscordIds.mockReset();
  auth.resolveDiscordIdsForUserIds.mockReset();
});

describe('accountIdOfDiscord', () => {
  it('tells "no account" (null) from "auth did not answer" (undefined)', async () => {
    auth.resolveUsersByDiscordIds.mockResolvedValueOnce([]);
    await expect(accountIdOfDiscord(DISCORD)).resolves.toBeNull();

    clearAccountLinkCache();
    auth.resolveUsersByDiscordIds.mockRejectedValueOnce(new Error('fetch failed'));
    await expect(accountIdOfDiscord(DISCORD)).resolves.toBeUndefined();
  });

  it('caches lookups, "no account" included', async () => {
    auth.resolveUsersByDiscordIds.mockResolvedValue([]);
    await accountIdOfDiscord(DISCORD);
    await accountIdOfDiscord(DISCORD);
    expect(auth.resolveUsersByDiscordIds).toHaveBeenCalledTimes(1);
  });
});

describe('discordIdOfUser', () => {
  it('returns null for an account without Discord or when auth fails', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValueOnce(new Map());
    await expect(discordIdOfUser('u1')).resolves.toBeNull();
    auth.resolveDiscordIdsForUserIds.mockRejectedValueOnce(new Error('timeout'));
    await expect(discordIdOfUser('u2')).resolves.toBeNull();
  });
});

describe('reconcileAccountLinks', () => {
  function fakeClient() {
    return {
      dispensaryDiscordProfile: { updateMany: vi.fn(async () => ({ count: 1 })) },
      dispensaryWeeklyActivity: { updateMany: vi.fn(async () => ({ count: 1 })) },
    };
  }

  it('links, relinks and unlinks profiles and rows from the current account', async () => {
    auth.resolveUsersByDiscordIds.mockResolvedValue([
      { discordId: DISCORD, userId: 'u-new', name: 'Owen' },
    ]);
    const client = fakeClient();
    const links = await reconcileAccountLinks(client as never, 'd1', [DISCORD, '999999999999999999']);

    expect(links?.get(DISCORD)).toBe('u-new');
    expect(links?.get('999999999999999999')).toBeNull();
    expect(client.dispensaryDiscordProfile.updateMany).toHaveBeenCalledWith({
      where: {
        dispensaryId: 'd1',
        discordUserId: DISCORD,
        OR: [{ userId: null }, { userId: { not: 'u-new' } }],
      },
      data: { userId: 'u-new' },
    });
    expect(client.dispensaryWeeklyActivity.updateMany).toHaveBeenCalledWith({
      where: { dispensaryId: 'd1', discordUserId: '999999999999999999', userId: { not: null } },
      data: { userId: null },
    });
  });

  it('changes nothing when auth does not answer', async () => {
    auth.resolveUsersByDiscordIds.mockRejectedValue(new Error('fetch failed'));
    const client = fakeClient();
    await expect(reconcileAccountLinks(client as never, 'd1', [DISCORD])).resolves.toBeUndefined();
    expect(client.dispensaryDiscordProfile.updateMany).not.toHaveBeenCalled();
  });
});
