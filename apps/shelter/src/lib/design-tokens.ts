/**
 * 1890 refuge design tokens (poster palette: parchment / terracotta / charcoal).
 * Colors and shadows are CSS variables whose values come from the active theme
 * (`lib/themes`); palettes are the Mantine color scales.
 */
export const shelterTokens = {
  /** Theme-dependent: CSS variables generated from `lib/themes` (never raw hex in components). */
  colors: {
    background: 'var(--shelter-ui-bg)',
    surface: 'var(--shelter-ui-surface)',
    surfaceBorder: 'var(--shelter-ui-border)',
    ink: 'var(--shelter-ui-ink)',
    inkMuted: 'var(--shelter-ui-muted)',
    terracotta: 'var(--shelter-terracotta)',
    sageDust: 'var(--shelter-sage-dust)',
    leather: 'var(--shelter-leather)',
    danger: 'var(--shelter-danger)',
    tableHeader: 'var(--shelter-ui-table-header)',
    tableZebra: 'var(--shelter-ui-table-zebra)',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    modal: '8px',
  },
  shadows: {
    card: 'var(--shelter-ui-shadow-card)',
    header: 'var(--shelter-ui-shadow-header)',
    elevated: 'var(--shelter-ui-shadow-elevated)',
  },
  fonts: {
    display: 'var(--font-display), var(--font-ui), "Courier New", Courier, monospace',
    ui: 'var(--font-ui), "Courier New", Courier, monospace',
    mono: 'var(--font-ui), "Courier New", Courier, monospace',
  },
} as const;

/** Primary brick / poster red-brown */
export const terracottaPalette = [
  '#f6ebe6',
  '#ecd5cc',
  '#dbb3a4',
  '#c88f7a',
  '#b56f58',
  '#a05742',
  '#8B4532',
  '#783b2b',
  '#643224',
  '#50291d',
] as const;

/** Soft dusty sage from posters */
export const sageDustPalette = [
  '#f3f4ee',
  '#e4e7d9',
  '#cdd3b8',
  '#b5be98',
  '#a4ac86',
  '#939b76',
  '#7f8765',
  '#6b7355',
  '#585f46',
  '#464b38',
] as const;

export const dangerPalette = [
  '#f5e6e6',
  '#e8c8c8',
  '#d49a9a',
  '#c06c6c',
  '#a84040',
  '#9a2e2e',
  '#8B2323',
  '#771e1e',
  '#631919',
  '#4f1414',
] as const;

export const slatePalette = [
  '#f3f1ef',
  '#e5e1dc',
  '#d0cac3',
  '#b5ada4',
  '#9a9187',
  '#827970',
  '#6A635C',
  '#5a544e',
  '#4b4641',
  '#3E3B39',
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

export function shelterPillStyle(palette: readonly string[]) {
  // light-dark() follows the theme's color-scheme (see host-kit/theme darkSoftColors for the dark recipe).
  return {
    backgroundColor: `light-dark(${palette[1]}, color-mix(in srgb, ${palette[5]} 24%, transparent))`,
    color: `light-dark(${palette[8]}, ${palette[2]})`,
    border: `1px solid light-dark(${palette[3]}, color-mix(in srgb, ${palette[4]} 45%, transparent))`,
  };
}
