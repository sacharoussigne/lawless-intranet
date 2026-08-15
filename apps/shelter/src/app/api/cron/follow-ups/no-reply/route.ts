import { NextResponse } from 'next/server';
import { markStaleFollowUpsNoReply } from '@/lib/animals/followUpCron';

export async function POST(request: Request) {
  const secret = process.env.FOLLOW_UP_CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Cron secret not configured' }, { status: 503 });
  }

  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await markStaleFollowUpsNoReply(3);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error('[follow-ups/no-reply]', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
