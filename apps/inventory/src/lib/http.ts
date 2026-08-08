import { NextResponse } from 'next/server';
import { errorResponse, jsonResponse } from '@/lib/auth';
import type { DomainResult } from '@/lib/result';

export function fromDomainResult(request: Request, result: DomainResult<unknown>): NextResponse {
  if (!result.ok) {
    if (result.data !== undefined) {
      return jsonResponse(request, { error: result.error, data: result.data }, result.status);
    }
    return errorResponse(request, result.error, result.status);
  }
  return jsonResponse(request, result.data, result.status ?? 200);
}
