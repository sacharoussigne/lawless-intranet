import { createFetchRead } from '@lawless-intranet/host-kit/read';
import type { ReadRoutes } from '@/lib/read/readRoutes';

/** GET counterpart of the read actions in `readRoutes`, for client refetches. */
export const fetchRead = createFetchRead<ReadRoutes>(
  (shelterSlug) => `/api/s/${encodeURIComponent(shelterSlug)}/read`,
);
