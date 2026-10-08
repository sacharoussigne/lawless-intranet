/**
 * Tenant scope and forwarded SSO cookie for a host calling the services
 * (bank, agenda, inventory, media…): one instance per host app.
 */
export function createServiceHost<S extends string>({
  scopeType,
  getCookieHeader,
}: {
  scopeType: S;
  getCookieHeader: () => Promise<string | null>;
}) {
  return {
    scopeType,
    scope: (tenantId: string) => ({ scopeType, scopeId: tenantId }),
    cookie: async () => ({ cookieHeader: await getCookieHeader() }),
  };
}
