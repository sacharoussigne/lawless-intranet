import type { CSSProperties } from 'react';

type ApothecaryPalette = readonly [
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

const slatePalette = [
  '#f4f1eb',
  '#e8e3da',
  '#d8d0c4',
  '#c0b5a6',
  '#a69a8a',
  '#8f8375',
  '#6B5F52',
  '#5c5249',
  '#4e4640',
  '#3d3429',
] as const;

const mossPalette = [
  '#e9f0eb',
  '#d5e3d9',
  '#b6ccb9',
  '#92b098',
  '#73957c',
  '#5f8269',
  '#4f6f58',
  '#435c4b',
  '#384b3f',
  '#2d3d34',
] as const;

const denimPalette = [
  '#e8eef5',
  '#d0dce9',
  '#a8bfd3',
  '#7a9bb8',
  '#557a9c',
  '#426585',
  '#35536e',
  '#2d465c',
  '#263b4d',
  '#1e2f3d',
] as const;

const amberPalette = [
  '#faf3e4',
  '#f3e4c4',
  '#e8cd92',
  '#d9b15e',
  '#c9963d',
  '#b07d2e',
  '#926528',
  '#785324',
  '#634521',
  '#52391d',
] as const;

const dangerPalette = [
  '#f8eaea',
  '#efd4d4',
  '#e0aaaa',
  '#cd7a7a',
  '#b85555',
  '#a04040',
  '#853535',
  '#6e2e2e',
  '#5c2929',
  '#4c2323',
] as const;

export function apothecaryPillStyle(palette: ApothecaryPalette): CSSProperties {
  // light-dark() follows the theme's color-scheme: the palette's tints in light themes,
  // translucent mid shades with light text in dark ones (same recipe as host-kit/theme darkSoftColors).
  return {
    backgroundColor: `light-dark(${palette[1]}, color-mix(in srgb, ${palette[5]} 24%, transparent))`,
    color: `light-dark(${palette[8]}, ${palette[2]})`,
    border: `1px solid light-dark(${palette[3]}, color-mix(in srgb, ${palette[4]} 45%, transparent))`,
  };
}

export const apothecaryBooleanPills = {
  yes: apothecaryPillStyle(mossPalette),
  no: apothecaryPillStyle(slatePalette),
  noAlert: apothecaryPillStyle(dangerPalette),
} as const;

export { denimPalette, amberPalette, dangerPalette, mossPalette, slatePalette };
