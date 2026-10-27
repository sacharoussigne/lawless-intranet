import type { AuthSession } from '@lawless-intranet/types';
import { BUSINESS_MEMBER_ROLES, Role, parseRoleList } from '@/types/enum/roles';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';

/**
 * « Voir en tant que » (like Discord): an admin browses a business as if they
 * only held some roles. The cookie only ever lowers rights: it is applied when
 * the real user is a platform admin or an admin of that business, and the
 * session then loses its platform role, so every `isPlatformAdmin` check falls.
 * The business role and permissions come from `viewAs` (lib/business/context,
 * permissionsResolve). Same user id: only the rights change.
 */

export const VIEW_AS_COOKIE = 'disp-view-as';
export const VIEW_AS_MAX_AGE_S = 8 * 60 * 60;

export type ViewAsState = {
  businessId: string;
  /** Roles of the view (comma list, as `BusinessMember.role`). */
  roles: string;
  /** Platform role of the real user, kept to leave the view. */
  realRole: string | null;
};

/** Session with the view applied, if any. */
export type ViewAsSession = AuthSession & { viewAs?: ViewAsState };

export type ViewAsCookie = { businessId: string; roles: string[] };

export function serializeViewAsCookie(value: ViewAsCookie): string {
  return `${value.businessId}:${value.roles.join(',')}`;
}

/** Cookie value: `<businessId>:<roles>`; null when malformed or without a known role. */
export function parseViewAsCookie(raw: string | null | undefined): ViewAsCookie | null {
  if (!raw) return null;
  const decoded = decodeURIComponent(raw);
  const separator = decoded.indexOf(':');
  if (separator <= 0) return null;
  const businessId = decoded.slice(0, separator);
  const roles = parseRoleList(decoded.slice(separator + 1)).filter((role) =>
    (BUSINESS_MEMBER_ROLES as readonly string[]).includes(role),
  );
  return roles.length > 0 ? { businessId, roles: [...new Set(roles)].sort() } : null;
}

/** Value of the view cookie in a `cookie` header. */
export function viewAsCookieFromHeader(cookieHeader: string | null | undefined): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const [name, ...value] = part.trim().split('=');
    if (name === VIEW_AS_COOKIE) return value.join('=');
  }
  return null;
}

/**
 * Applies the view to a session. `isBusinessAdmin` checks the real member role
 * (only called when a cookie is there and the user is not a platform admin).
 */
export async function applyViewAs(
  session: AuthSession | null,
  cookieHeader: string | null | undefined,
  isBusinessAdmin: (userId: string, businessId: string) => Promise<boolean>,
): Promise<ViewAsSession | null> {
  if (!session?.user) return session;
  const view = parseViewAsCookie(viewAsCookieFromHeader(cookieHeader));
  if (!view) return session;

  const realRole = session.user.role ?? null;
  const allowed = isPlatformAdmin(realRole) || (await isBusinessAdmin(session.user.id, view.businessId));
  if (!allowed) return session;

  return {
    ...session,
    user: { ...session.user, role: Role.USER },
    viewAs: { businessId: view.businessId, roles: view.roles.join(','), realRole },
  };
}
