import { createFetchRead } from '@lawless-intranet/host-kit/read';
import type { PlatformReadRoutes } from '@/lib/read/platformReadRoutes';

/** GET counterpart of the platform read actions (`platformReadRoutes`). The slug argument is unused: pass ''. */
export const fetchPlatformRead = createFetchRead<PlatformReadRoutes>(() => '/api/platform/read');
