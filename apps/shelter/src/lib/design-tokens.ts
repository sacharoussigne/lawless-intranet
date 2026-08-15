/**
 * 1890 refuge design tokens (poster palette: parchment / terracotta / charcoal).
 * Consumed by theme.ts and global SCSS via CSS variables.
 */
export const shelterTokens = {
  colors: {
    background: '#F0E6D6',
    surface: '#FBF6EE',
    surfaceBorder: '#DCCBB3',
    ink: '#3E3B39',
    inkMuted: '#6A635C',
    terracotta: '#8B4532',
    sageDust: '#A4AC86',
    leather: '#8B5E3C',
    danger: '#8B2323',
    tableHeader: '#E8DCC8',
    tableZebra: '#F5EDE0',
  },
  radius: {
    sm: '4px',
    md: '6px',
    lg: '8px',
    modal: '8px',
  },
  shadows: {
    card: '0 1px 2px rgba(62, 59, 57, 0.05), 0 2px 6px rgba(62, 59, 57, 0.04)',
    header: '0 1px 0 rgba(220, 203, 179, 0.9), 0 2px 6px rgba(62, 59, 57, 0.04)',
    elevated: '0 3px 12px rgba(62, 59, 57, 0.08)',
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
  return {
    backgroundColor: palette[1],
    color: palette[8],
    border: `1px solid ${palette[3]}`,
  };
}

/** CSS custom properties injected on :root via globals.scss */
export function shelterCssVariables(): Record<string, string> {
  const t = shelterTokens;
  return {
    '--shelter-bg': t.colors.background,
    '--shelter-bg-accent': t.colors.tableHeader,
    '--shelter-surface': t.colors.surface,
    '--shelter-border': t.colors.surfaceBorder,
    '--shelter-ink': t.colors.ink,
    '--shelter-muted': t.colors.inkMuted,
    '--shelter-terracotta': t.colors.terracotta,
    '--shelter-sage-dust': t.colors.sageDust,
    '--shelter-leather': t.colors.leather,
    '--shelter-danger': t.colors.danger,
    '--shelter-table-header': t.colors.tableHeader,
    '--shelter-table-zebra': t.colors.tableZebra,
    '--shelter-shadow-card': t.shadows.card,
    '--shelter-shadow-header': t.shadows.header,
    '--shelter-font-display': t.fonts.display,
    '--shelter-font-ui': t.fonts.ui,
  };
}
