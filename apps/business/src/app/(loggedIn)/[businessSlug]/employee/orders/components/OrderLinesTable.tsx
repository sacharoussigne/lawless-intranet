'use client';

import { Table, Text } from '@mantine/core';
import { calculateOrderPriceFromItems, normalizeItemPrice } from '@/lib/orders/calculateOrderPriceFromItems';
import { calculateOrderWeightFromItems } from '@/lib/orders/calculateOrderWeightFromItems';
import { formatOrderPrice } from '@/lib/orders/chatterLines';
import type { OrderItem } from '@/types/orders';

type OrderLinesTableProps = {
  lines: OrderItem[];
  /** Price of the order, shown under the catalog total when it differs (manual or older price). */
  orderPrice: number | null;
  priceManual: boolean;
};

function formatWeight(weight: number | null | undefined) {
  return weight != null && weight > 0 ? `${weight.toFixed(2)} kg` : '—';
}

/** Read-only items of an order with their catalog price, subtotal and weight. */
export function OrderLinesTable({ lines, orderPrice, priceManual }: OrderLinesTableProps) {
  const catalogTotal = calculateOrderPriceFromItems(
    lines.map((line) => ({ quantity: line.quantity, price: line.item.price })),
  );
  const totalWeight = calculateOrderWeightFromItems(
    lines.map((line) => ({ quantity: line.quantity, weight: line.item.weight })),
  );
  const missingPrices = lines.filter((line) => {
    const price = normalizeItemPrice(line.item.price);
    return price == null || price <= 0;
  }).length;
  const priceDiffers = orderPrice != null && orderPrice !== catalogTotal;

  return (
    <Table.ScrollContainer minWidth={520}>
      <Table striped highlightOnHover>
        <Table.Thead>
          <Table.Tr>
            <Table.Th>Objet</Table.Th>
            <Table.Th ta="right">Quantité</Table.Th>
            <Table.Th ta="right">Prix catalogue</Table.Th>
            <Table.Th ta="right">Sous-total</Table.Th>
            <Table.Th ta="right">Poids</Table.Th>
          </Table.Tr>
        </Table.Thead>
        <Table.Tbody>
          {lines.map((line) => {
            const unitPrice = normalizeItemPrice(line.item.price);
            const hasPrice = unitPrice != null && unitPrice > 0;
            const weight = line.item.weight != null ? line.item.weight * line.quantity : null;
            return (
              <Table.Tr key={line.id ?? line.itemId}>
                <Table.Td>{line.item.name}</Table.Td>
                <Table.Td ta="right">{line.quantity}</Table.Td>
                <Table.Td ta="right">
                  {hasPrice ? (
                    formatOrderPrice(unitPrice)
                  ) : (
                    <Text span size="sm" c="dimmed">
                      sans prix
                    </Text>
                  )}
                </Table.Td>
                <Table.Td ta="right">{hasPrice ? formatOrderPrice(unitPrice * line.quantity) : '—'}</Table.Td>
                <Table.Td ta="right">{formatWeight(weight)}</Table.Td>
              </Table.Tr>
            );
          })}
        </Table.Tbody>
        <Table.Tfoot>
          <Table.Tr>
            <Table.Th colSpan={3}>
              Total catalogue
              {missingPrices > 0 && (
                <Text span size="xs" c="dimmed" fw={400}>
                  {' '}
                  ({missingPrices} article{missingPrices > 1 ? 's' : ''} sans prix)
                </Text>
              )}
            </Table.Th>
            <Table.Th ta="right">{formatOrderPrice(catalogTotal)}</Table.Th>
            <Table.Th ta="right">{formatWeight(totalWeight)}</Table.Th>
          </Table.Tr>
          {priceDiffers && (
            <Table.Tr>
              <Table.Th colSpan={3}>
                Prix de la commande{' '}
                <Text span size="xs" c="dimmed" fw={400}>
                  ({priceManual ? 'saisi à la main' : 'enregistré'})
                </Text>
              </Table.Th>
              <Table.Th ta="right">{formatOrderPrice(orderPrice)}</Table.Th>
              <Table.Th />
            </Table.Tr>
          )}
        </Table.Tfoot>
      </Table>
    </Table.ScrollContainer>
  );
}
