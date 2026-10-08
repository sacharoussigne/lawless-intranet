import type { NextResponse } from 'next/server';
import type { z } from 'zod';
import { errorResponse, jsonResponse } from '@/lib/auth';
import type { LibraryResult } from '@/lib/library';
import { parseJsonBody } from '@/lib/resolve';
import { StorageNotConfiguredError } from '@/lib/s3';
import { readScopeQuery, zodErrorMessage } from '@/lib/validation';

export type RouteContext = { params: Promise<{ id: string }> };

/** Runs a library operation and maps its result (or a thrown error) to a response. */
export async function respond<T>(
  run: () => Promise<LibraryResult<T>>,
  successStatus = 200,
): Promise<NextResponse> {
  try {
    const result = await run();
    return result.ok ? jsonResponse(result.data, successStatus) : errorResponse(result.error, result.status);
  } catch (error) {
    if (error instanceof StorageNotConfiguredError) {
      return errorResponse(error.message, 503);
    }
    console.error('[media] request failed', error);
    return errorResponse('Erreur interne du service média', 500);
  }
}

export async function parseBody<S extends z.ZodType>(
  request: Request,
  schema: S,
): Promise<{ ok: true; data: z.infer<S> } | { ok: false; response: NextResponse }> {
  const body = await parseJsonBody(request);
  if (body === null) {
    return { ok: false, response: errorResponse('JSON invalide', 400) };
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, response: errorResponse(zodErrorMessage(parsed.error), 400) };
  }
  return { ok: true, data: parsed.data };
}

export function parseQuery<S extends z.ZodType>(
  request: Request,
  schema: S,
): { ok: true; data: z.infer<S> } | { ok: false; response: NextResponse } {
  const parsed = schema.safeParse(readScopeQuery(request));
  if (!parsed.success) {
    return { ok: false, response: errorResponse(zodErrorMessage(parsed.error), 400) };
  }
  return { ok: true, data: parsed.data };
}
