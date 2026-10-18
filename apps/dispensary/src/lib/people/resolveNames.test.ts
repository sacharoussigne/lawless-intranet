import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyFixedNames, pickProfileDisplayName } from '@/lib/people/displayName';

const auth = vi.hoisted(() => ({
  resolveDiscordIdsForUserIds: vi.fn<(ids: string[]) => Promise<Map<string, string>>>(),
  resolveUsersByDiscordIds: vi.fn(),
}));
vi.mock('@lawless-intranet/auth-client/internal', () => auth);

const { applyBusinessNamesToUsers, loadFixedNamesForUsers } = await import('@/lib/people/resolveNames');
const { clearAccountLinkCache } = await import('@/lib/people/accountLinks');

type Profile = {
  businessId: string;
  discordUserId: string;
  userId: string | null;
  fixedDisplayName: string | null;
  updatedAt: Date;
};

type Where = Record<string, unknown>;

function matches(p: Profile, where: Where): boolean {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return (condition as Where[]).some((w) => matches(p, w));
    const value = p[key as keyof Profile];
    if (condition && typeof condition === 'object') {
      if ('in' in condition) return (condition.in as unknown[]).includes(value);
      if ('not' in condition) return value !== condition.not;
    }
    return value === condition;
  });
}

/** In-memory `businessDiscordProfile` delegate, enough for the queries of resolveNames. */
function fakeClient(profiles: Profile[]) {
  return {
    businessDiscordProfile: {
      findMany: async ({ where }: { where: Where }) =>
        profiles
          .filter((p) => matches(p, where))
          .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()),
    },
  } as unknown as Parameters<typeof loadFixedNamesForUsers>[0];
}

function profile(overrides: Partial<Profile>): Profile {
  return {
    businessId: 'd1',
    discordUserId: '111111111111111111',
    userId: null,
    fixedDisplayName: null,
    updatedAt: new Date(),
    ...overrides,
  };
}

beforeEach(() => {
  clearAccountLinkCache();
  auth.resolveDiscordIdsForUserIds.mockReset();
});

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
  it('uses the profile of the account’s current Discord id', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['u1', '111111111111111111']]));
    const client = fakeClient([profile({ userId: 'u1', fixedDisplayName: 'Owen Clark' })]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.get('u1')).toBe('Owen Clark');
  });

  it('finds a profile created before the account (no userId yet)', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['u2', '222222222222222222']]));
    const client = fakeClient([
      profile({ discordUserId: '222222222222222222', fixedDisplayName: 'Violet Clark' }),
    ]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u2']);
    expect(names.get('u2')).toBe('Violet Clark');
  });

  it('ignores a stale profile left by a Discord id the account no longer holds', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['u1', '333333333333333333']]));
    const client = fakeClient([
      profile({ discordUserId: '111111111111111111', userId: 'u1', fixedDisplayName: 'Ancien nom' }),
      profile({ discordUserId: '333333333333333333', userId: 'u1', fixedDisplayName: 'Nom actuel' }),
    ]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.get('u1')).toBe('Nom actuel');
  });

  it('falls back to the stored link when auth does not answer', async () => {
    auth.resolveDiscordIdsForUserIds.mockRejectedValue(new Error('fetch failed'));
    const client = fakeClient([profile({ userId: 'u1', fixedDisplayName: 'Owen Clark' })]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.get('u1')).toBe('Owen Clark');
  });

  it('leaves accounts without Discord (no profile) alone', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map());
    const names = await loadFixedNamesForUsers(fakeClient([]), 'd1', ['u3']);
    expect(names.size).toBe(0);
  });

  it('only reads the profiles of the dispensary', async () => {
    auth.resolveDiscordIdsForUserIds.mockResolvedValue(new Map([['u1', '111111111111111111']]));
    const client = fakeClient([profile({ businessId: 'other', userId: 'u1', fixedDisplayName: 'Ailleurs' })]);
    const names = await loadFixedNamesForUsers(client, 'd1', ['u1']);
    expect(names.size).toBe(0);
  });
});

describe('applyBusinessNamesToUsers', () => {
  it('keeps the SSO names when nothing can be read', async () => {
    auth.resolveDiscordIdsForUserIds.mockRejectedValue(new Error('fetch failed'));
    const users = new Map([['u9', { name: 'SSO' }]]);
    const named = await applyBusinessNamesToUsers(fakeClient([]), 'd1', users);
    expect(named.get('u9')?.name).toBe('SSO');
  });
});
