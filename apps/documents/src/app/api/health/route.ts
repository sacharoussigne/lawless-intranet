import { corsPreflightResponse, withCors } from '@/lib/cors';
import { NextResponse } from 'next/server';

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  return withCors(
    request,
    NextResponse.json({ status: 'ok', service: 'documents' }),
  );
}
