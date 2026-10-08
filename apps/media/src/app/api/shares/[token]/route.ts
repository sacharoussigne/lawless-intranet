import { requireInternal } from '@/lib/auth';
import { resolveShare } from '@/lib/library';
import { respond } from '@/lib/route';

type ShareRouteContext = { params: Promise<{ token: string }> };

/** Internal secret only: the host serves the public link and checks its own rules. */
export async function GET(request: Request, context: ShareRouteContext) {
  const forbidden = requireInternal(request);
  if (forbidden) return forbidden;

  const { token } = await context.params;
  return respond(() => resolveShare(token));
}
