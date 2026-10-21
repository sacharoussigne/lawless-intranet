import { fetchBusinessUserProfiles } from '@/lib/people/userProfiles';
import type { OrderPerson } from '@/types/orders';

/** Names and avatars of the given users in this business (unknown accounts are left out). */
export async function loadOrderPeople(
  businessId: string,
  userIds: Array<string | null | undefined>,
): Promise<Record<string, OrderPerson>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return {};
  const profiles = await fetchBusinessUserProfiles(businessId, ids);
  const people: Record<string, OrderPerson> = {};
  for (const id of ids) {
    const profile = profiles.get(id);
    if (profile) people[id] = { userId: id, name: profile.name, image: profile.image ?? null };
  }
  return people;
}
