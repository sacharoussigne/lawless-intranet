import { createRouteResponses } from '@lawless-intranet/service-kit/http';
import { withCors } from '@/lib/cors';

export type { AuthenticatedContext } from '@lawless-intranet/service-kit/http';

export const { requireSession, jsonResponse, errorResponse } = createRouteResponses({
  withCors,
});
