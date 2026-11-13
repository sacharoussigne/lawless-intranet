import type { User } from '@/types/users';

export const USERS_PAGE_SIZE = 10;

export type UsersPage = { users: User[]; total: number };

/** Auth « list users » answer (untyped JSON) → the users of one page and the total. */
export function toUsersPage(data: unknown): UsersPage {
  const page = (data ?? {}) as { users?: User[]; total?: number };
  return {
    users: (page.users ?? []).map((user) => ({ ...user, role: user.role ?? null })),
    total: page.total ?? 0,
  };
}
