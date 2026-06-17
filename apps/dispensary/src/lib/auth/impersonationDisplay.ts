import { fetchUserProfile } from '@/lib/authUsers';

export async function getImpersonatorDisplayName(
  impersonatorUserId: string | null | undefined,
): Promise<string | null> {
  if (!impersonatorUserId) return null;
  const user = await fetchUserProfile(impersonatorUserId);
  return user?.name ?? null;
}
