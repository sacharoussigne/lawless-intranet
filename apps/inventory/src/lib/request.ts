import { z } from 'zod';
import { scopeFieldsSchema, zodErrorMessage } from '@/lib/validation';

export function parseScopeQuery(url: URL) {
  const parsed = scopeFieldsSchema.safeParse({
    scopeType: url.searchParams.get('scopeType'),
    scopeId: url.searchParams.get('scopeId'),
  });
  if (!parsed.success) {
    return { ok: false as const, error: zodErrorMessage(parsed.error) };
  }
  return { ok: true as const, data: parsed.data };
}

export function parseJsonBody<T extends z.ZodType>(
  schema: T,
  body: unknown,
): { ok: true; data: z.infer<T> } | { ok: false; error: string } {
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, error: zodErrorMessage(parsed.error) };
  }
  return { ok: true, data: parsed.data };
}
