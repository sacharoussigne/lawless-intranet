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
 * Palette name by its main shade (index 6), to use the theme's soft tints
 * (`--disp-<name>-soft-*`, see the dispensary `lib/themes`). Hosts without
 * these variables keep the palette's own shades.
 */
const PALETTE_NAMES: Record<string, string> = {
  '#4a6b5a': 'sage',
  '#8b5e3c': 'leather',
  '#9b4d4d': 'danger',
  '#6b5f52': 'slate',
  '#735268': 'wine',
  '#8a6b48': 'clay',
  '#b07d35': 'amber',
  '#4f6f58': 'moss',
  '#526d80': 'denim',
};

function themed(palette: ApothecaryPalette, variable: string, shade: number): string {
  const name = PALETTE_NAMES[palette[6].toLowerCase()];
  return name ? `var(--disp-${name}-${variable}, ${palette[shade]})` : palette[shade];
}

/**
 * Soft label style: cream tint background, readable ink-like text, subtle border.
 * Works with Badge variant="outline" (ignores Mantine filled/light fills).
 */
export function apothecaryPillStyle(palette: ApothecaryPalette): CSSProperties {
  return {
    backgroundColor: themed(palette, 'soft-strong', 1),
    color: themed(palette, 'soft-text', 8),
    border: `1px solid ${themed(palette, 'soft-border', 3)}`,
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
