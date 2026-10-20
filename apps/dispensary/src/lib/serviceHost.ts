import { createServiceHost } from '@lawless-intranet/host-kit/service-host';
import { getCookieHeader } from '@/lib/authUsers';

/** Scope (`business` + business id) and forwarded cookie shared by every service call of this app. */
export const serviceHost = createServiceHost({ scopeType: 'business', getCookieHeader });
