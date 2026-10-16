import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  resolveUsersByDiscordIds: vi.fn(),
  resolveDiscordIdsForUserIds: vi.fn(),
  searchAuthUsers: vi.fn(),
  fetchUserProfiles: vi.fn(),
  findMany: vi.fn(),
}));

vi.mock('@lawless-intranet/auth-client/internal', () => ({
  resolveUsersByDiscordIds: mocks.resolveUsersByDiscordIds,
  resolveDiscordIdsForUserIds: mocks.resolveDiscordIdsForUserIds,
}));
vi.mock('@/lib/authUsers', () => ({
  searchAuthUsers: mocks.searchAuthUsers,
  fetchUserProfiles: mocks.fetchUserProfiles,
}));
vi.mock('@/lib/prisma', () => ({
  default: { dispensaryDiscordProfile: { findMany: mocks.findMany } },
}));

const { resolveActorIds, resolveActorNames } = await import('@/lib/logs/actors');

beforeEach(() => {
  vi.clearAllMocks();
  mocks.resolveUsersByDiscordIds.mockResolvedValue([]);
  mocks.resolveDiscordIdsForUserIds.mockResolvedValue(new Map());
  mocks.searchAuthUsers.mockResolvedValue([]);
  mocks.fetchUserProfiles.mockResolvedValue(new Map());
  mocks.findMany.mockResolvedValue([]);
});

describe('resolveActorIds', () => {
  it('finds the account of a Discord id', async () => {
    mocks.resolveUsersByDiscordIds.mockResolvedValue([
      { discordId: '284726189304512512', userId: 'u1', name: 'Owen' },
    ]);
    const ids = await resolveActorIds('284726189304512512');
    expect(ids.discordIds).toContain('284726189304512512');
    expect(ids.userIds).toContain('u1');
  });

  it('finds the Discord id of a user id', async () => {
    mocks.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['Kq9xTzP3mWv7rL2a', '111111111111111111']]));
    const ids = await resolveActorIds('Kq9xTzP3mWv7rL2a');
    expect(ids.userIds).toContain('Kq9xTzP3mWv7rL2a');
    expect(ids.discordIds).toContain('111111111111111111');
  });

  it('finds people without an account and accounts without Discord by name', async () => {
    mocks.findMany.mockResolvedValue([{ discordUserId: '222222222222222222', userId: null }]);
    mocks.searchAuthUsers.mockResolvedValue([{ id: 'u-no-discord', discordId: null }]);
    const ids = await resolveActorIds('Violet Clark');
    expect(ids.discordIds).toContain('222222222222222222');
    expect(ids.userIds).toContain('u-no-discord');
  });

  it('does not look up a user id for an ordinary name', async () => {
    await resolveActorIds('Jean');
    expect(mocks.resolveDiscordIdsForUserIds).not.toHaveBeenCalled();
  });

  it('still searches the raw text when the auth service fails', async () => {
    mocks.searchAuthUsers.mockRejectedValue(new Error('fetch failed'));
    const ids = await resolveActorIds('Jack');
    expect(ids.userIds).toEqual(['Jack']);
    expect(ids.discordIds).toEqual(['Jack']);
  });
});

describe('resolveActorNames', () => {
  it('prefers the fixed name, then the account name, then the bot name', async () => {
    mocks.fetchUserProfiles.mockResolvedValue(new Map([['u1', { name: 'owen_sso' }], ['u2', { name: 'Sans Discord' }]]));
    mocks.findMany.mockResolvedValue([
      { discordUserId: '111111111111111111', userId: 'u1', fixedDisplayName: 'Owen Clark', lastDisplayName: 'owen' },
      { discordUserId: '333333333333333333', userId: null, fixedDisplayName: null, lastDisplayName: 'pseudo bot' },
    ]);
    const names = await resolveActorNames([
      { userId: 'u1', discordUserId: '111111111111111111' },
      { userId: 'u2', discordUserId: null },
      { userId: null, discordUserId: '333333333333333333' },
    ]);
    expect(names.u1).toBe('Owen Clark');
    expect(names['111111111111111111']).toBe('Owen Clark');
    expect(names.u2).toBe('Sans Discord');
    expect(names['333333333333333333']).toBe('pseudo bot');
  });
});
