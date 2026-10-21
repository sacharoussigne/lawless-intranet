import { headers } from 'next/headers';
import { listAccessibleBusinesses } from '@/lib/business/context';
import { businessOrigin, businessTypeOfHost, requestHostOf } from '@/lib/business/hosts';
import type { AccessibleBusiness } from '@/types/permissions';

type SessionLike = Parameters<typeof listAccessibleBusinesses>[0];

/** Host of the current request and the kind of business it serves (null: every kind). */
export async function currentBusinessHost() {
  const current = requestHostOf(await headers());
  return { ...current, type: businessTypeOfHost(current.host) };
}

/** Businesses the user can open, each with where to open it from this host. */
export async function listAccessibleBusinessesForRequest(
  session: SessionLike,
): Promise<AccessibleBusiness[]> {
  const [businesses, current] = await Promise.all([
    listAccessibleBusinesses(session),
    currentBusinessHost(),
  ]);
  return businesses.map((b) => ({ ...b, origin: businessOrigin(b.type, current) }));
}
