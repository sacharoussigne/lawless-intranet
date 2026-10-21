import { chain as hostChain } from '@lawless-intranet/host-kit/middleware';
import type { AppMiddleware, AppMiddlewareSession } from '@/types/middlewareSession';

export const chain = (...middlewares: AppMiddleware[]) =>
  hostChain<AppMiddlewareSession>(...middlewares);
