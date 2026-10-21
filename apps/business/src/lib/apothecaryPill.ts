import type { CSSProperties } from 'react';
import {
  denimPalette,
  dangerPalette,
  leatherPalette,
  mossPalette,
  slatePalette,
} from '@/lib/design-tokens';

/** Mantine 10-shade palette */
export type ApothecaryPalette = readonly [
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
  string,
];

/**
 * Soft label style: cream tint background, readable ink-like text, subtle border.
 * Works with Badge variant="outline" (ignores Mantine filled/light fills).
 */
export function apothecaryPillStyle(palette: ApothecaryPalette): CSSProperties {
  // light-dark() follows the theme's color-scheme: the palette's tints in light themes,
  // translucent mid shades with light text in dark ones (same recipe as host-kit/theme darkSoftColors).
  return {
    backgroundColor: `light-dark(${palette[1]}, color-mix(in srgb, ${palette[5]} 24%, transparent))`,
    color: `light-dark(${palette[8]}, ${palette[2]})`,
    border: `1px solid light-dark(${palette[3]}, color-mix(in srgb, ${palette[4]} 45%, transparent))`,
  };
}

/** Common yes/no and status pill styles for tables and forms */
export const apothecaryBooleanPills = {
  yes: apothecaryPillStyle(mossPalette),
  no: apothecaryPillStyle(slatePalette),
  noAlert: apothecaryPillStyle(dangerPalette),
  craft: apothecaryPillStyle(leatherPalette),
  commerce: apothecaryPillStyle(denimPalette),
} as const;
