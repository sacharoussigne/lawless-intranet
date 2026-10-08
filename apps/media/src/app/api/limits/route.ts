import { NextResponse } from 'next/server';
import { jsonResponse, requireSession } from '@/lib/auth';
import { getLimits } from '@/lib/library';

export async function GET(request: Request) {
  const auth = await requireSession(request);
  if (auth instanceof NextResponse) return auth;
  return jsonResponse(getLimits());
}
