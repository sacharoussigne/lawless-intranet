import { hasInternalSecret } from '@lawless-intranet/service-kit/internal-secret';

export const DOCUMENTS_INTERNAL_SECRET_HEADER = 'x-documents-internal-secret';

export function isDocumentsInternalAuthorized(request: Request): boolean {
  return hasInternalSecret(request, {
    env: 'DOCUMENTS_INTERNAL_SECRET',
    header: DOCUMENTS_INTERNAL_SECRET_HEADER,
  });
}
