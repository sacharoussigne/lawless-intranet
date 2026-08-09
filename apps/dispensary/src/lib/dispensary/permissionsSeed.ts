import {
  flattenRoleMatrix,
  DEFAULT_ROLE_MATRIX,
} from '@lawless-intranet/auth-permissions';
import prisma from '@/lib/prisma';

type PrismaClientLike = {
  dispensaryRolePermission: {
    count: (args: { where: { dispensaryId: string } }) => Promise<number>;
    createMany: (args: {
      data: Array<{
        dispensaryId: string;
        role: string;
        resource: string;
        action: string;
      }>;
      skipDuplicates?: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { dispensaryId: string } }) => Promise<unknown>;
  };
};

export function buildDefaultRolePermissionRows(dispensaryId: string) {
  return flattenRoleMatrix(DEFAULT_ROLE_MATRIX).map((row) => ({
    dispensaryId,
    role: row.role,
    resource: row.resource,
    action: row.action,
  }));
}

/** Seed default role matrix when the dispensary has no role permissions yet. */
export async function ensureDispensaryRolePermissions(
  dispensaryId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const count = await client.dispensaryRolePermission.count({
    where: { dispensaryId },
  });
  if (count > 0) {
    return;
  }
  await client.dispensaryRolePermission.createMany({
    data: buildDefaultRolePermissionRows(dispensaryId),
    skipDuplicates: true,
  });
}

/** Replace role matrix with code defaults. */
export async function resetDispensaryRolePermissionsToDefaults(
  dispensaryId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.dispensaryRolePermission.deleteMany({ where: { dispensaryId } });
  await client.dispensaryRolePermission.createMany({
    data: buildDefaultRolePermissionRows(dispensaryId),
  });
}
