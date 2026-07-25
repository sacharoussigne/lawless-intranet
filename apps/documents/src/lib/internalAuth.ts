export const DOCUMENTS_INTERNAL_SECRET_HEADER = 'x-documents-internal-secret';

export function isDocumentsInternalAuthorized(request: Request): boolean {
  const secret = process.env.DOCUMENTS_INTERNAL_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get(DOCUMENTS_INTERNAL_SECRET_HEADER) === secret;
}
