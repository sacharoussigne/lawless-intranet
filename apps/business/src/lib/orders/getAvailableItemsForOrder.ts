import { OrderTypeEnum } from '@/types/enum/orderType';
import type { ItemWithRelations } from '@/types/stock';

export function getAvailableItemsForOrder(params: {
  orderType: OrderTypeEnum;
  allItems: ItemWithRelations[];
  companyGroupId?: string | null;
  firstOrderItemId?: string | null;
}): ItemWithRelations[] {
  const { orderType, allItems, companyGroupId, firstOrderItemId } = params;

  // A sale only offers enabled items marked "Peut être vendu".
  if (orderType === OrderTypeEnum.OUTGOING) {
    return allItems.filter((item) => item.canBeSold === true && item.isEnabled !== false);
  }

  let groupId = companyGroupId;
  if (!groupId && firstOrderItemId) {
    const firstItem = allItems.find((item) => item.id === firstOrderItemId);
    groupId = firstItem?.companyGroupId ?? null;
  }

  if (!groupId) {
    return [];
  }

  return allItems.filter(
    (item) => !item.isCraftable && item.companyGroupId === groupId,
  );
}
