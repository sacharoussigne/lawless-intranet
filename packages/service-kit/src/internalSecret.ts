import { timingSafeEqual } from 'node:crypto';

export type InternalSecretConfig = {
  /** Env var holding the shared secret, e.g. `BANK_INTERNAL_SECRET`. */
  env: string;
  /** Request header carrying it, e.g. `x-bank-internal-secret`. */
  header: string;
};

/** True when the request carries the configured internal secret (constant-time comparison). */
export function hasInternalSecret(request: Request, { env, header }: InternalSecretConfig): boolean {
  const secret = process.env[env];
  const provided = request.headers.get(header);
  if (!secret || !provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
