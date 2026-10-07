import { errorResponse, jsonResponse, requireInternal } from '@/lib/auth';
import { cleanupAbandonedUploads } from '@/lib/uploadsCleanup';

/** Manual trigger (internal secret); the service also runs it hourly on its own. */
export async function POST(request: Request) {
  const forbidden = requireInternal(request);
  if (forbidden) return forbidden;

  try {
    return jsonResponse(await cleanupAbandonedUploads());
  } catch (error) {
    console.error('[media] abandoned uploads cleanup failed', error);
    return errorResponse('Erreur interne du service média', 500);
  }
}
