import { createFetchRead } from '@lawless-intranet/host-kit/read';
import type { ReadRoutes } from '@/lib/read/readRoutes';

/** GET counterpart of the read actions in `readRoutes`, for React Query `queryFn`s. */
export const fetchRead = createFetchRead<ReadRoutes>(
  (dispensarySlug) => `/api/d/${encodeURIComponent(dispensarySlug)}/read`,
);
