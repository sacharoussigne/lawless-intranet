import { createReadRouteHandler } from '@lawless-intranet/host-kit/read';
import { readRoutes } from '@/lib/read/readRoutes';

export const dynamic = 'force-dynamic';

/** Client-side reads (see lib/read/readRoutes): same-origin only, no CORS on purpose. */
export const GET = createReadRouteHandler(readRoutes, 'businessSlug');
