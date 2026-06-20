export function isInternalAuthAuthorized(request: Request): boolean {
  const secret = process.env.AUTH_INTERNAL_SECRET;
  if (!secret) {
    return false;
  }

  return request.headers.get('x-auth-internal-secret') === secret;
}
