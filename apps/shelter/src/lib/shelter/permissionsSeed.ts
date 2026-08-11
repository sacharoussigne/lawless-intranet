import {
  flattenRoleMatrix,
  DEFAULT_ROLE_MATRIX,
} from '@/lib/shelter/permissionsCatalog';
import prisma from '@/lib/prisma';

type PrismaClientLike = {
  shelterRolePermission: {
    count: (args: { where: { shelterId: string } }) => Promise<number>;
    createMany: (args: {
      data: Array<{
        shelterId: string;
        role: string;
        resource: string;
        action: string;
      }>;
      skipDuplicates?: boolean;
    }) => Promise<unknown>;
    deleteMany: (args: { where: { shelterId: string } }) => Promise<unknown>;
  };
};

export function buildDefaultRolePermissionRows(shelterId: string) {
  return flattenRoleMatrix(DEFAULT_ROLE_MATRIX).map((row) => ({
    shelterId,
    role: row.role,
    resource: row.resource,
    action: row.action,
  }));
}

export async function ensureShelterRolePermissions(
  shelterId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  const count = await client.shelterRolePermission.count({
    where: { shelterId },
  });
  if (count > 0) {
    return;
  }
  await client.shelterRolePermission.createMany({
    data: buildDefaultRolePermissionRows(shelterId),
    skipDuplicates: true,
  });
}

export async function resetShelterRolePermissionsToDefaults(
  shelterId: string,
  client: PrismaClientLike = prisma,
): Promise<void> {
  await client.shelterRolePermission.deleteMany({ where: { shelterId } });
  await client.shelterRolePermission.createMany({
    data: buildDefaultRolePermissionRows(shelterId),
  });
}
