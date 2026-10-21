import type { BusinessType } from '@prisma/client';
import { flattenRoleMatrix } from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';
import { getBusinessTypeDefinition } from '@/lib/businessTypes';

type PrismaClientLike = {
  businessRolePermission: {
    count: (args: { where: { businessId: string } }) => Promise<number>;
    createMany: (args: {
      data: Array<{
        businessId: string;
        role: string;
        resource: string;
        action: string;
      }>;
      skipDuplicates?: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { businessId: string } }) => Promise<unknown>;
  };
};

/** Kind of the business, when the caller does not have it at hand. */
async function businessTypeOf(businessId: string): Promise<BusinessType> {
  const row = await prisma.business.findUnique({
    where: { id: businessId },
    select: { type: true },
  });
  if (!row) throw new Error('Entreprise introuvable');
  return row.type;
}

export function buildDefaultRolePermissionRows(businessId: string, type: BusinessType) {
  return flattenRoleMatrix(getBusinessTypeDefinition(type).defaultRoleMatrix).map((row) => ({
    businessId,
    role: row.role,
    resource: row.resource,
    action: row.action,
  }));
}

/** Seed the default role matrix of its type when the business has no role permissions yet. */
export async function ensureBusinessRolePermissions(
  businessId: string,
  client: PrismaClientLike = prisma,
  type?: BusinessType,
): Promise<void> {
  const count = await client.businessRolePermission.count({
    where: { businessId },
  });
  if (count > 0) {
    return;
  }
  await client.businessRolePermission.createMany({
    data: buildDefaultRolePermissionRows(businessId, type ?? (await businessTypeOf(businessId))),
    skipDuplicates: true,
  });
}

/** Replace the role matrix with the defaults of the business type. */
export async function resetBusinessRolePermissionsToDefaults(
  businessId: string,
  type: BusinessType,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.businessRolePermission.deleteMany({ where: { businessId } });
  await client.businessRolePermission.createMany({
    data: buildDefaultRolePermissionRows(businessId, type),
  });
}
