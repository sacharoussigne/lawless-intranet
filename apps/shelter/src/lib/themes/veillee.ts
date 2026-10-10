import { darkSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { SHELTER_SOFT_PALETTES } from './palettes';

const bg = '#1E1A17';
const surface = '#28221E';
const border = '#3E362F';
const ink = '#EDE3D4';
const muted = '#B3A795';
const tableHeader = '#302823';
const tableZebra = '#241F1B';
const shadowCard = '0 1px 3px rgba(0, 0, 0, 0.35), 0 3px 10px rgba(0, 0, 0, 0.25)';
const shadowHeader = '0 1px 0 rgba(62, 54, 47, 0.9), 0 2px 8px rgba(0, 0, 0, 0.3)';

/** « Veillée » : warm charcoal by the fire, terracotta and sage lightened for contrast. */
export const veilleeTheme: ThemeDefinition = {
  id: 'veillee',
  label: 'Veillée',
  scheme: 'dark',
  tokens: {
    bg,
    bgAccent: '#2A2420',
    surface,
    border,
    ink,
    muted,
    terracotta: '#D08868',
    sageDust: '#B7BF99',
    leather: '#C2895C',
    danger: '#D47A72',
    tableHeader,
    tableZebra,
    shadowCard,
    shadowHeader,
    shadowSoft: '0 1px 2px rgba(0, 0, 0, 0.3)',

    // The light theme's two historical sets collapse into one here.
    uiBg: bg,
    uiSurface: surface,
    uiBorder: border,
    uiInk: ink,
    uiMuted: muted,
    uiTableHeader: tableHeader,
    uiTableZebra: tableZebra,
    uiShadowCard: shadowCard,
    uiShadowHeader: shadowHeader,
    uiShadowElevated: '0 4px 16px rgba(0, 0, 0, 0.4)',
  },
  soft: Object.fromEntries(Object.entries(SHELTER_SOFT_PALETTES).map(([name, palette]) => [name, darkSoftColors(palette)])),
};
