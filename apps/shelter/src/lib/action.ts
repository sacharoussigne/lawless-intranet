import { createActionErrorParser } from '@lawless-intranet/host-kit/action';

export { handleAction } from '@lawless-intranet/host-kit/action';

/** Zod issues are keyed by their dotted path (`root` for the whole object). */
export const actionErrorParser = createActionErrorParser((error) =>
  error.issues.map((issue) => ({
    field: issue.path.join('.') || 'root',
    message: issue.message,
  })),
);
