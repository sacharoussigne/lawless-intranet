import { createCors } from '@lawless-intranet/service-kit/http';
import { getTrustedOrigins } from '@/lib/constants';

export const { withCors, corsPreflightResponse } = createCors({
  getTrustedOrigins,
  allowHeaders: 'Content-Type, Authorization, Cookie, X-Inventory-Internal-Secret, X-Scope-Id',
});
