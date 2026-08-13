import { type NextRequest, NextResponse } from 'next/server';

export function shelterBase(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`;
}

export function tenantRoutes(slug: string) {
  const base = shelterBase(slug);
  const employeeBase = `${base}/employee`;
  return {
    employee: {
      index: employeeBase,
      bank: `${employeeBase}/bank`,
      species: `${employeeBase}/species`,
      animals: `${employeeBase}/animals`,
      animal: (id: string) => `${employeeBase}/animals/${encodeURIComponent(id)}`,
    },
    bank: { index: `${employeeBase}/bank` },
    species: { index: `${employeeBase}/species` },
    animals: { index: `${employeeBase}/animals` },
    admin: {
      settings: `${base}/admin/settings`,
      members: `${base}/admin/members`,
    },
  };
}

export const routes = {
  platform: {
    shelters: '/platform/shelters',
    users: '/platform/users',
  },
  settings: {
    index: '/settings',
  },
  auth: {
    index: '/auth',
    login: '/auth/login',
    logout: '/auth/logout',
    noAccess: '/auth/no-access',
    noManagementAccess: '/auth/no-management-access',
    noShelterAccess: '/auth/no-shelter-access',
  },
  redirect: (request: NextRequest, route: string) => {
    return NextResponse.redirect(new URL(route, request.url));
  },
};
