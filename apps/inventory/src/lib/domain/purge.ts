import prisma from '@/lib/prisma';
import { scopeWhere } from '@/lib/scope';
import { ok, type DomainResult } from '@/lib/result';

export async function purgeScope(
  scopeType: string,
  scopeId: string,
): Promise<DomainResult<{ deleted: true }>> {
  const where = scopeWhere(scopeType, scopeId);

  await prisma.$transaction(async (tx) => {
    await tx.saleItem.deleteMany({ where: { sale: where } });
    await tx.sale.deleteMany({ where });

    await tx.stockItemMovement.deleteMany({ where: { item: where } });
    await tx.stockHistory.deleteMany({ where: { item: where } });

    await tx.orderItem.deleteMany({ where: { order: where } });
    await tx.order.deleteMany({ where });
    await tx.orderMailTemplateAssignment.deleteMany({ where });

    await tx.craftRecipeItem.deleteMany({ where: { craftRecipe: where } });
    await tx.craftRecipe.deleteMany({ where });

    await tx.chestHiddenCategory.deleteMany({ where: { chest: where } });
    await tx.chestHiddenItem.deleteMany({ where: { chest: where } });
    await tx.chestStockCheckCategory.deleteMany({
      where: { config: { chest: where } },
    });
    await tx.chestStockCheckConfig.deleteMany({ where: { chest: where } });

    await tx.roleChestAccessChest.deleteMany({ where: { access: where } });
    await tx.roleChestAccess.deleteMany({ where });

    await tx.companyGroupCompany.deleteMany({
      where: { company: where },
    });

    await tx.item.deleteMany({ where });
    await tx.company.deleteMany({ where });
    await tx.companyGroup.deleteMany({ where });
    await tx.individualCustomer.deleteMany({ where });
    await tx.chest.deleteMany({ where });
    await tx.categoryItem.deleteMany({ where });
  });

  return ok({ deleted: true });
}
