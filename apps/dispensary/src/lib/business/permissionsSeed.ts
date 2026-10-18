import {
  flattenRoleMatrix,
  DEFAULT_ROLE_MATRIX,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';

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

export function buildDefaultRolePermissionRows(businessId: string) {
  return flattenRoleMatrix(DEFAULT_ROLE_MATRIX).map((row) => ({
    businessId,
    role: row.role,
    resource: row.resource,
    action: row.action,
  }));
}

/** Seed default role matrix when the dispensary has no role permissions yet. */
export async function ensureBusinessRolePermissions(
  businessId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const count = await client.businessRolePermission.count({
    where: { businessId },
  });
  if (count > 0) {
    return;
  }
  await client.businessRolePermission.createMany({
    data: buildDefaultRolePermissionRows(businessId),
    skipDuplicates: true,
  });
}

/** Replace role matrix with code defaults. */
export async function resetBusinessRolePermissionsToDefaults(
  businessId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.businessRolePermission.deleteMany({ where: { businessId } });
  await client.businessRolePermission.createMany({
    data: buildDefaultRolePermissionRows(businessId),
  });
}
