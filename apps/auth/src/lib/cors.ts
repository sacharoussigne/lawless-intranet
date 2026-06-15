import { NextResponse } from 'next/server';
import { getTrustedOrigins } from '@/lib/constants';

export function withCors(request: Request, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin');
  const trustedOrigins = getTrustedOrigins();

  if (origin && trustedOrigins.includes(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set('Vary', 'Origin');
  }

  return response;
}

export function corsPreflightResponse(request: Request): NextResponse {
  const response = new NextResponse(null, { status: 204 });
  response.headers.set(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  );
  response.headers.set(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, Cookie',
  );
  return withCors(request, response);
}
