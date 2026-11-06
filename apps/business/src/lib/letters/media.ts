import { deleteMediaFile } from '@lawless-intranet/media-client/server';
import type { MediaScopeParams } from '@lawless-intranet/types';
import { mediaCookie } from '@/lib/media/client';

/** Letter images live in the media service, in their own scope: never listed by the media library. */
export const LETTERS_MEDIA_SCOPE_TYPE = 'business-letters';

export function lettersMediaScope(businessId: string): MediaScopeParams {
  return { scopeType: LETTERS_MEDIA_SCOPE_TYPE, scopeId: businessId };
}

/** Best effort: a file left behind costs storage only, never access (nobody can list the scope). */
export async function deleteLetterMediaFiles(businessId: string, fileIds: string[]): Promise<void> {
  if (fileIds.length === 0) return;
  const options = await mediaCookie();
  const scope = lettersMediaScope(businessId);
  const results = await Promise.allSettled(fileIds.map((id) => deleteMediaFile(scope, id, options)));
  const failed = results.filter((result) => result.status === 'rejected').length;
  if (failed > 0) console.error(`Letters: ${failed} media file(s) not deleted`);
}
