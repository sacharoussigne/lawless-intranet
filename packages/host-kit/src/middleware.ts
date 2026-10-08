import { type NextRequest, NextResponse } from 'next/server';

export type HostMiddleware<S> = (
  req: NextRequest,
  session: S,
) => NextResponse | Response | Promise<NextResponse | Response>;

/** Runs middlewares in order; the first redirect, rewrite, error or JSON response wins. */
export function chain<S>(...middlewares: HostMiddleware<S>[]) {
  return async (req: NextRequest, session: S) => {
    for (const middleware of middlewares) {
      const result = await middleware(req, session);
      if (
        result.headers.get('Location') ||
        result.status !== 200 ||
        result.headers.get('x-middleware-rewrite') ||
        result.headers.get('content-type') === 'application/json'
      ) {
        return result;
      }
    }
    return NextResponse.next();
  };
}
