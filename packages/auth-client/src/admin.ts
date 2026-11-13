import { authFetch, normalizeAuthRequestContext, type AuthRequestContext } from './config';

type ListUsersParams = {
  searchValue?: string;
  searchField?: 'email' | 'name';
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
};

async function adminFetch(
  path: string,
  init: RequestInit & {
    cookieHeader?: string | null;
    origin?: string | null;
  } = {},
) {
  const response = await authFetch(path, init);
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw new Error(
      typeof data === 'object' && data && 'message' in data
        ? String((data as { message: string }).message)
        : `Auth admin request failed (${response.status})`,
    );
  }

  return data;
}

/** Lowercase, without accents: what the user search compares. */
function normalizeSearch(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

type ListedUser = { name?: string | null; email?: string | null };

const SEARCH_SCAN_LIMIT = 5000;

/**
 * Users of the auth app. A search ignores case and accents (« william » finds « William Smith »):
 * Better Auth only matches the exact case, so the search loads the users (up to SEARCH_SCAN_LIMIT)
 * and filters and pages here.
 */
export async function listUsers(
  params: ListUsersParams | undefined,
  context?: AuthRequestContext,
) {
  const search = params?.searchValue?.trim();
  if (!search) return fetchUsers(params, context);

  // Better Auth caps an unbounded list at 100: ask for more explicitly.
  const all = (await fetchUsers(
    { ...params, searchValue: undefined, limit: SEARCH_SCAN_LIMIT, offset: undefined },
    context,
  )) as { users?: ListedUser[] } | null;
  const needle = normalizeSearch(search);
  const field = params?.searchField ?? 'name';
  const matches = (all?.users ?? []).filter((user) => normalizeSearch(user[field] ?? '').includes(needle));
  const offset = params?.offset ?? 0;
  const users = params?.limit != null ? matches.slice(offset, offset + params.limit) : matches.slice(offset);
  return { users, total: matches.length, limit: params?.limit, offset };
}

async function fetchUsers(
  params: ListUsersParams | undefined,
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  const query = new URLSearchParams();
  if (params?.searchValue) query.set('searchValue', params.searchValue);
  if (params?.searchField) query.set('searchField', params.searchField);
  if (params?.limit != null) query.set('limit', String(params.limit));
  if (params?.offset != null) query.set('offset', String(params.offset));
  if (params?.sortBy) query.set('sortBy', params.sortBy);
  if (params?.sortDirection) query.set('sortDirection', params.sortDirection);

  const suffix = query.toString();
  return adminFetch(`/api/auth/admin/list-users${suffix ? `?${suffix}` : ''}`, {
    cookieHeader,
    origin,
  });
}

export async function createUser(
  body: {
    email: string;
    password: string;
    name: string;
    role?: string | string[];
  },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/create-user', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function adminUpdateUser(
  body: Record<string, unknown>,
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/update-user', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function setRole(
  body: { userId: string; role: string | string[] },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/set-role', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function setUserPassword(
  body: { userId: string; newPassword: string },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/set-user-password', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function impersonateUser(
  body: { userId: string },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/impersonate-user', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function stopImpersonating(context?: AuthRequestContext) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/stop-impersonating', {
    method: 'POST',
    cookieHeader,
    origin,
  });
}

export async function updateUser(
  body: Record<string, unknown>,
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/update-user', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function changePassword(
  body: {
    currentPassword: string;
    newPassword: string;
    revokeOtherSessions?: boolean;
  },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/change-password', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export async function removeUser(
  body: { userId: string },
  context?: AuthRequestContext,
) {
  const { cookieHeader, origin } = normalizeAuthRequestContext(context);
  return adminFetch('/api/auth/admin/remove-user', {
    method: 'POST',
    cookieHeader,
    origin,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
