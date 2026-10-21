import { headers } from 'next/headers';
import { buildOriginFromHeaders } from '@lawless-intranet/auth-client/config';

export async function getAuthRequestContext() {
  const requestHeaders = await headers();

  return {
    cookieHeader: requestHeaders.get('cookie'),
    origin: buildOriginFromHeaders(requestHeaders),
  };
}
