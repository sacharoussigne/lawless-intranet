import type { ReadRegistry } from '@lawless-intranet/host-kit/read';
import {
  listAnimalsForWaitlistLink,
  listAnimalWaitRequests,
  listOpenWaitRequestsPreview,
} from '@/app/_actions/animalWaitRequests';

/**
 * Reads exposed as GET (`/api/s/<slug>/read/<query>`) for client refetches.
 * Server actions run one at a time per tab, in the navigation queue; these run
 * in parallel. Each entry reuses the read action as-is: auth, tenant, feature
 * and permission checks stay in the action. Only the keys listed here exist.
 */
export const readRoutes = {
  // Waitlist (page and header indicator)
  waitRequests: (slug: string, input: Parameters<typeof listAnimalWaitRequests>[1]) =>
    listAnimalWaitRequests(slug, input),
  openWaitRequestsPreview: (slug: string, _input?: undefined) =>
    listOpenWaitRequestsPreview(slug),
  animalsForWaitlistLink: (slug: string, _input?: undefined) => listAnimalsForWaitlistLink(slug),
} satisfies ReadRegistry;

export type ReadRoutes = typeof readRoutes;
