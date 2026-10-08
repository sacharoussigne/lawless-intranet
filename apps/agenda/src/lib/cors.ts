import { createCors } from '@lawless-intranet/service-kit/http';
import { getTrustedOrigins } from '@/lib/constants';

export const { withCors, corsPreflightResponse } = createCors({
  getTrustedOrigins,
});
