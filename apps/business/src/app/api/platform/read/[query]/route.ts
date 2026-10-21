import { createReadRouteHandler } from '@lawless-intranet/host-kit/read';
import { platformReadRoutes } from '@/lib/read/platformReadRoutes';

export const dynamic = 'force-dynamic';

/** Platform reads (see lib/read/platformReadRoutes): same-origin only, no slug. */
export const GET = createReadRouteHandler(platformReadRoutes, 'slug');
