import { type NextRequest, NextResponse } from 'next/server';

export function shelterBase(slug: string): string {
  return `/s/${encodeURIComponent(slug)}`;
}

export function tenantRoutes(slug: string) {
  const base = shelterBase(slug);
  const employeeBase = `${base}/employee`;
  const managementBase = `${base}/management`;
  return {
    employee: {
      index: employeeBase,
      bank: `${employeeBase}/bank`,
      animals: `${employeeBase}/animals`,
      animal: (id: string) => `${employeeBase}/animals/${encodeURIComponent(id)}`,
      animalFollowUp: (animalId: string, followUpId: string) =>
        `${employeeBase}/animals/${encodeURIComponent(animalId)}/follow-ups/${encodeURIComponent(followUpId)}`,
      waitlist: `${employeeBase}/waitlist`,
    },
    management: {
      index: managementBase,
      species: `${managementBase}/species`,
      templates: `${managementBase}/templates`,
      templateNew: `${managementBase}/templates/new`,
      templateEdit: (id: string) =>
        `${managementBase}/templates/${encodeURIComponent(id)}/edit`,
      templateTest: (id: string) =>
        `${managementBase}/templates/${encodeURIComponent(id)}/test`,
    },
    bank: { index: `${employeeBase}/bank` },
    species: { index: `${managementBase}/species` },
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
