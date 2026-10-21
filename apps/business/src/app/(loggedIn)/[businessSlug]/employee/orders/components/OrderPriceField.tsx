'use client';

import { Anchor, Badge, Group, NumberInput, Text } from '@mantine/core';
import { apothecaryPillStyle } from '@/lib/apothecaryPill';
import { amberPalette, sagePalette } from '@/lib/design-tokens';
import {
  displayedOrderPrice,
  typeOrderPrice,
  type OrderPriceState,
} from '@/lib/orders/orderPriceMode';

type OrderPriceFieldProps = {
  state: OrderPriceState;
  onChange: (state: OrderPriceState) => void;
  /** Catalog total of the items (null when none of them has a price). */
  suggestedPrice: number | null;
  disabled?: boolean;
  /** Completed order: its saved price, shown as is (the catalog may have changed since). */
  frozenPrice?: number | null;
};

function formatPrice(value: number) {
  return `${value.toFixed(2)} $`;
}

/**
 * Order price: follows the items' catalog prices until one is typed by hand,
 * with a way back to the computed price.
 */
export function OrderPriceField({
  state,
  onChange,
  suggestedPrice,
  disabled,
  frozenPrice,
}: OrderPriceFieldProps) {
  if (frozenPrice !== undefined) {
    return (
      <NumberInput
        label="Prix"
        decimalScale={2}
        fixedDecimalScale
        prefix="$ "
        value={frozenPrice ?? ''}
        disabled
      />
    );
  }

  const description = state.manual ? (
    <Group gap={4} component="span">
      <span>Saisi à la main.</span>
      {!disabled && (
        <Anchor
          component="button"
          type="button"
          size="xs"
          onClick={() => onChange({ manual: false, manualPrice: '' })}
        >
          {suggestedPrice != null
            ? `Revenir au prix calculé (${formatPrice(suggestedPrice)})`
            : 'Revenir au prix calculé'}
        </Anchor>
      )}
    </Group>
  ) : suggestedPrice != null ? (
    'Calculé à partir des prix du catalogue.'
  ) : (
    'Aucun prix catalogue pour ces articles : saisissez-le si besoin.'
  );

  return (
    <NumberInput
      label={
        <Group gap={6} component="span" wrap="nowrap">
          <Text span size="sm" fw={500}>
            Prix
          </Text>
          <Badge
            size="xs"
            variant="outline"
            radius="sm"
            style={apothecaryPillStyle(state.manual ? amberPalette : sagePalette)}
          >
            {state.manual ? 'Manuel' : 'Auto'}
          </Badge>
        </Group>
      }
      description={description}
      placeholder="Prix de la commande"
      min={0}
      decimalScale={2}
      fixedDecimalScale
      prefix="$ "
      value={displayedOrderPrice(state, suggestedPrice)}
      onChange={(value) => onChange(typeOrderPrice(value))}
      disabled={disabled}
    />
  );
}
