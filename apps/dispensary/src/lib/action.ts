import { createActionErrorParser } from '@lawless-intranet/host-kit/action';
import { zodErrorParser } from './services/zod';

export { handleAction } from '@lawless-intranet/host-kit/action';

/** Zod issues are keyed by their top-level field (forms use flat field names). */
export const actionErrorParser = createActionErrorParser(zodErrorParser);
