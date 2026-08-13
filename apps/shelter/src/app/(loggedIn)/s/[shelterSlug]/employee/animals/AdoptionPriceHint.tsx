'use client';

import { Text } from '@mantine/core';
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
  let comparison: string;
  if (adoptionPrice < animalierPurchasePrice) {
    comparison = 'moins cher';
  } else if (adoptionPrice > animalierPurchasePrice) {
    comparison = 'plus cher';
  } else {
    comparison = 'même prix';
  }

  return (
    <Text size="sm" c="dimmed">
      {comparison === 'même prix'
        ? `Même prix que l'animalier (${animalierLabel})`
        : `${comparison.charAt(0).toUpperCase()}${comparison.slice(1)} que l'animalier (${animalierLabel})`}
    </Text>
  );
}
