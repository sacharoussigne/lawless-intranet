import { createServiceHost } from '@lawless-intranet/host-kit/service-host';
import { getCookieHeader } from '@/lib/authUsers';

/** Scope (`shelter` + id) and forwarded cookie shared by every service call of this app. */
export const serviceHost = createServiceHost({ scopeType: 'shelter', getCookieHeader });
