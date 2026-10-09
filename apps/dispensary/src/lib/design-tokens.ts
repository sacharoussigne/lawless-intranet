/**
 * Apothecary / western RP design tokens (Saint-Denis dispensary).
 * Colors and shadows are CSS variables whose values come from the active theme
 * (`lib/themes`); palettes are the Mantine color scales.
 */
export const dispTokens = {
  /** Theme-dependent: CSS variables generated from `lib/themes` (never raw hex in components). */
  colors: {
    background: 'var(--disp-bg)',
    surface: 'var(--disp-surface)',
    surfaceBorder: 'var(--disp-surface-border)',
    ink: 'var(--disp-ink)',
    inkMuted: 'var(--disp-ink-muted)',
    sage: 'var(--disp-sage)',
    leather: 'var(--disp-leather)',
    gold: 'var(--disp-gold)',
    danger: 'var(--disp-danger)',
    tableHeader: 'var(--disp-table-header)',
    tableZebra: 'var(--disp-table-zebra)',
  },
  radius: {
    sm: '8px',
    md: '12px',
    lg: '14px',
    modal: '14px',
  },
  shadows: {
    card: 'var(--disp-shadow-card)',
    header: 'var(--disp-shadow-header)',
    elevated: 'var(--disp-shadow-elevated)',
  },
  fonts: {
    display: 'var(--font-display), var(--font-ui), "Courier New", Courier, monospace',
    ui: 'var(--font-ui), "Courier New", Courier, monospace',
    mono: 'var(--font-ui), "Courier New", Courier, monospace',
  },
} as const;

export const sagePalette = [
  '#eef3ef',
  '#d9e5dc',
  '#b8cfc0',
  '#96b8a3',
  '#74a187',
  '#5d8f72',
  '#4A6B5A',
  '#3f5c4d',
  '#354e41',
  '#2a4035',
] as const;

export const leatherPalette = [
  '#f5ebe3',
  '#e8d5c4',
  '#d4b89a',
  '#c09b76',
  '#a67f58',
  '#946d47',
  '#8B5E3C',
  '#785234',
  '#65462c',
  '#523a24',
] as const;

export const dangerPalette = [
  '#f5e8e8',
  '#e8cfcf',
  '#d4a8a8',
  '#c08080',
  '#a85858',
  '#9b5454',
  '#9B4D4D',
  '#854343',
  '#6f3939',
  '#592f2f',
] as const;

/** Warm gray — draft, neutral states */
export const slatePalette = [
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

/** Dusty plum — correspondence, secondary emphasis */
export const winePalette = [
  '#f3eaef',
  '#e6d5df',
  '#d4b8c8',
  '#b995ad',
  '#9f7a92',
  '#87647c',
  '#735268',
  '#624658',
  '#523b4a',
  '#43313c',
] as const;

/** Pale warm orange — soft warnings */
export const amberPalette = [
  '#faf4eb',
  '#f5e8d4',
  '#edd4b0',
  '#e0b87a',
  '#d4a256',
  '#c4903f',
  '#b07d35',
  '#94682c',
  '#7a5524',
  '#61441d',
] as const;

/** Muted terracotta — in progress, outgoing accents */
export const clayPalette = [
  '#f5ebe3',
  '#e8d9c9',
  '#d9c0a5',
  '#c4a07a',
  '#b08d62',
  '#9c7a52',
  '#8a6b48',
  '#755a3c',
  '#614b32',
  '#4f3d28',
] as const;

/** Deep sage — completed, success */
export const mossPalette = [
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

/** Muted blue-gray — incoming, info */
export const denimPalette = [
  '#edf1f4',
  '#d9e2e9',
  '#b9c9d6',
  '#94aabd',
  '#7893a8',
  '#637f94',
  '#526d80',
  '#465c6d',
  '#3a4d5b',
  '#2f404c',
] as const;
