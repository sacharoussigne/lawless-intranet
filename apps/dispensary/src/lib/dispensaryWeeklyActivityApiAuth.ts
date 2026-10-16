import { isDiscordUserId } from '@/lib/people/discordId';
import { timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';
import { getAppFeatureActionBlock } from '@/lib/appSettings';

export function isDispensaryBotApiAuthorized(request: NextRequest): boolean {
  const secret = process.env.DISPENSARY_BOT_API_SECRET?.trim();
  if (!secret) {
    return false;
  }
  const auth = request.headers.get('authorization');
  if (!auth?.toLowerCase().startsWith('bearer ')) {
    return false;
  }
  const token = auth.slice(7).trim();
  if (token.length !== secret.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(secret, 'utf8'));
  } catch {
    return false;
  }
}

/** Discord id sent by the bot; anything that is not a Discord id (17-20 digits) counts as missing. */
export function getDiscordUserIdFromBotRequest(request: NextRequest): string | null {
  const id = request.headers.get('x-discord-user-id')?.trim();
  return id && isDiscordUserId(id) ? id : null;
}

export function getDispensaryIdFromBotRequest(request: NextRequest): string | null {
  const header = request.headers.get('x-dispensary-id')?.trim();
  if (header) return header;
  const url = new URL(request.url);
  const query = url.searchParams.get('dispensaryId')?.trim();
  return query && query.length > 0 ? query : null;
}

export async function assertBotDispensaryWeeklyActivityEnabled(
  dispensaryId: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const block = await getAppFeatureActionBlock(dispensaryId, 'weeklyDispensaryActivity');
  if (block) {
    return { ok: false, status: block.status, error: block.error };
  }
  return { ok: true };
}
