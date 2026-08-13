'use client';

import { Group, Text } from '@mantine/core';
import { IconCheck, IconMinus, IconX } from '@tabler/icons-react';
import { formatMoney } from './types';

export function AdoptionPriceHint({
  adoptionPrice,
  animalierPurchasePrice,
}: {
  adoptionPrice: number | null;
  animalierPurchasePrice: number | null;
}) {
  if (animalierPurchasePrice == null || adoptionPrice == null) return null;

  const animalierLabel = formatMoney(animalierPurchasePrice);
  let color: string;
  let Icon: typeof IconCheck;
  let label: string;

  if (adoptionPrice < animalierPurchasePrice) {
    color = 'teal';
    Icon = IconCheck;
    label = `Moins cher que l'animalier (${animalierLabel})`;
  } else if (adoptionPrice > animalierPurchasePrice) {
    color = 'danger';
    Icon = IconX;
    label = `Plus cher que l'animalier (${animalierLabel})`;
  } else {
    color = 'leather';
    Icon = IconMinus;
    label = `Même prix que l'animalier (${animalierLabel})`;
  }

  return (
    <Group gap={6} mt={4} wrap="nowrap" c={color}>
      <Icon size={14} stroke={2} />
      <Text size="sm">{label}</Text>
    </Group>
  );
}
