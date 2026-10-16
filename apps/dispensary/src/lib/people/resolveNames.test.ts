import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFixedNames, pickProfileDisplayName } from '@/lib/people/displayName';

const auth = vi.hoisted(() => ({
  resolveDiscordIdsForUserIds: vi.fn<(ids: string[]) => Promise<Map<string, string>>>(),
  resolveUsersByDiscordIds: vi.fn(),
}));
vi.mock('@lawless-intranet/auth-client/internal', () => auth);

const { applyDispensaryNamesToUsers, loadFixedNamesForUsers } = await import('@/lib/people/resolveNames');

type Profile = {
  dispensaryId: string;
  discordUserId: string;
  userId: string | null;
  fixedDisplayName: string | null;
};

/** In-memory `dispensaryDiscordProfile` delegate, enough for the queries of resolveNames. */
function fakeClient(profiles: Profile[]) {
  const matches = (p: Profile, where: Record<string, unknown>) =>
    Object.entries(where).every(([key, condition]) => {
      const value = p[key as keyof Profile];
      if (condition && typeof condition === 'object' && 'in' in condition) {
        return (condition.in as unknown[]).includes(value);
      }
      return value === condition;
    });
  return {
    dispensaryDiscordProfile: {
      findMany: async ({ where }: { where: Record<string, unknown> }) =>
        profiles.filter((p) => matches(p, where)),
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Profile> }) => {
        const hit = profiles.filter((p) => matches(p, where));
        hit.forEach((p) => Object.assign(p, data));
        return { count: hit.length };
      },
    },
  } as unknown as Parameters<typeof loadFixedNamesForUsers>[0];
}

describe('pickProfileDisplayName', () => {
  it('prefers the fixed name, then the bot name, then the fallback', () => {
    expect(pickProfileDisplayName({ fixedDisplayName: 'Jack Reffle', lastDisplayName: 'jacky' }, 'x')).toBe(
      'Jack Reffle',
    );
    expect(pickProfileDisplayName({ fixedDisplayName: '  ', lastDisplayName: 'jacky' }, 'x')).toBe('jacky');
    expect(pickProfileDisplayName(undefined, 'Médecin 123')).toBe('Médecin 123');
  });
});

describe('applyFixedNames', () => {
  it('replaces the SSO name only for accounts with a fixed name', () => {
    const users = new Map([
      ['u1', { name: 'owen_discord' }],
      ['u2', { name: 'Sans Discord' }],
    ]);
    const named = applyFixedNames(users, new Map([['u1', 'Owen Clark']]));
    expect(named.get('u1')?.name).toBe('Owen Clark');
    expect(named.get('u2')?.name).toBe('Sans Discord');
  });
});

describe('loadFixedNamesForUsers', () => {
  beforeEach(() => {
    auth.resolveDiscordIdsForUserIds.mockReset();
  });

  it('uses the profile already linked to the account', async () => {
    const client = fakeClient([
      { dispensaryId: 'd1', discordUserId: '111', userId: 'u1', fixedDisplayName: 'Owen Clark' },
    ]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.get('u1')).toBe('Owen Clark');
    expect(auth.resolveDiscordIdsForUserIds).not.toHaveBeenCalled();
  });

  it('links a profile created before the account, without duplicate', async () => {
    const profiles: Profile[] = [
      { dispensaryId: 'd1', discordUserId: '222', userId: null, fixedDisplayName: 'Violet Clark' },
    ];
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['u2', '222']]));
    const names = await loadFixedNamesForUsers(fakeClient(profiles), 'd1', ['u2']);
    expect(names.get('u2')).toBe('Violet Clark');
    expect(profiles).toHaveLength(1);
    expect(profiles[0].userId).toBe('u2');
  });

  it('leaves accounts without Discord (no profile) alone', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map());
    const names = await loadFixedNamesForUsers(fakeClient([]), 'd1', ['u3']);
    expect(names.size).toBe(0);
  });

  it('only reads the profiles of the dispensary', async () => {
    const client = fakeClient([
      { dispensaryId: 'other', discordUserId: '111', userId: 'u1', fixedDisplayName: 'Ailleurs' },
    ]);
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map());
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.size).toBe(0);
  });
});

describe('applyDispensaryNamesToUsers', () => {
  it('keeps the SSO names when the auth service fails', async () => {
    auth.resolveDiscordIdsForUserIds.mockRejectedValue(new Error('fetch failed'));
    const users = new Map([['u9', { name: 'SSO' }]]);
    const named = await applyDispensaryNamesToUsers(fakeClient([]), 'd1', users);
    expect(named.get('u9')?.name).toBe('SSO');
  });
});
