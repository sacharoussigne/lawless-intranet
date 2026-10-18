import { createFetchRead } from '@lawless-intranet/host-kit/read';
import type { ReadRoutes } from '@/lib/read/readRoutes';

/** GET counterpart of the read actions in `readRoutes`, for React Query `queryFn`s. */
export const fetchRead = createFetchRead<ReadRoutes>(
  (businessSlug) => `/api/d/${encodeURIComponent(businessSlug)}/read`,
);
