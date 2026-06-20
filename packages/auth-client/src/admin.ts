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

export async function listUsers(
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
