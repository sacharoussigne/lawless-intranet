/**
 * Name of a person in the dispensary. A Discord ID is the key of a person
 * (`DispensaryDiscordProfile`), with or without an intranet account:
 * 1. the name set by hand (`fixedDisplayName`), which nothing overwrites;
 * 2. the latest name sent by the bot or the activity form (`lastDisplayName`);
 * 3. the caller's fallback (SSO name, activity row name, « Médecin <id> »).
 */
export function pickProfileDisplayName(
  profile: { fixedDisplayName: string | null; lastDisplayName: string } | null | undefined,
  fallback: string,
): string {
  return profile?.fixedDisplayName?.trim() || profile?.lastDisplayName.trim() || fallback;
}

/**
 * Intranet accounts: the fixed name of their profile replaces the SSO name;
 * an account without a Discord ID (so without a profile) keeps its SSO name.
 */
export function applyFixedNames<T extends { name: string }>(
  usersById: Map<string, T>,
  fixedNameByUserId: Map<string, string>,
): Map<string, T> {
  if (fixedNameByUserId.size === 0) return usersById;
  return new Map(
    [...usersById].map(([userId, user]) => {
      const fixed = fixedNameByUserId.get(userId);
      return [userId, fixed ? { ...user, name: fixed } : user];
    }),
  );
}
