import { NextResponse } from 'next/server';
import { MediaClientError } from '@lawless-intranet/media-client';
import { resolveMediaShare } from '@lawless-intranet/media-client/server';
import { getAppFeatureActionBlock } from '@/lib/appSettings';
import { MEDIA_SCOPE_TYPE } from '@/lib/media/client';

export const dynamic = 'force-dynamic';

type ShareRouteContext = { params: Promise<{ token: string; name?: string[] }> };

function notFound() {
  return new NextResponse('Lien de partage invalide ou désactivé.', {
    status: 404,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/**
 * Public, never-expiring share link (e.g. posted on Discord). The trailing name
 * is cosmetic; the token alone resolves the file, then we redirect to a fresh
 * signed S3 URL. Not cached, so revoking the link takes effect immediately.
 */
export async function GET(_request: Request, context: ShareRouteContext) {
  const { token } = await context.params;
  try {
    const target = await resolveMediaShare(token);
    if (target.scopeType !== MEDIA_SCOPE_TYPE) return notFound();
    // Disabling the media library also disables its links.
    if (await getAppFeatureActionBlock(target.scopeId, 'media')) return notFound();

    const response = NextResponse.redirect(target.url, 302);
    response.headers.set('Cache-Control', 'no-store');
    return response;
  } catch (error) {
    if (error instanceof MediaClientError && error.status === 404) return notFound();
    console.error('[media] share link resolution failed', error);
    return new NextResponse('Service médiathèque indisponible.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
