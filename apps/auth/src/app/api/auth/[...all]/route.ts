import { toNextJsHandler } from 'better-auth/next-js';
import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { corsPreflightResponse, withCors } from '@/lib/cors';

const handlers = toNextJsHandler(auth.handler);

async function withCorsHandler(
  request: Request,
  handler: (request: Request) => Promise<Response>,
): Promise<Response> {
  const response = await handler(request);
  const nextResponse =
    response instanceof NextResponse
      ? response
      : new NextResponse(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
        });

  return withCors(request, nextResponse);
}

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function GET(request: Request) {
  return withCorsHandler(request, handlers.GET);
}

export async function POST(request: Request) {
  return withCorsHandler(request, handlers.POST);
}

export async function PATCH(request: Request) {
  return withCorsHandler(request, handlers.PATCH);
}

export async function PUT(request: Request) {
  return withCorsHandler(request, handlers.PUT);
}

export async function DELETE(request: Request) {
  return withCorsHandler(request, handlers.DELETE);
}
