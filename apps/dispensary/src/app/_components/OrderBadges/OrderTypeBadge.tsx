import { Badge } from '@mantine/core';
import type { OrderType } from '@lawless-intranet/types';
import { getOrderTypeLabel, getOrderTypePillStyle } from '@/types/enum/orderType';

export function OrderTypeBadge({ type }: { type: OrderType }) {
  return (
    <Badge variant="outline" radius="sm" style={getOrderTypePillStyle(type)}>
      {getOrderTypeLabel(type)}
    </Badge>
  );
}
