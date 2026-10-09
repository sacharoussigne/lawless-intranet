import { darkSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { DISP_SOFT_PALETTES } from './palettes';

/** « Lampe à huile » : warm dark, the same accents lightened for contrast. */
export const nuitTheme: ThemeDefinition = {
  id: 'nuit',
  label: 'Lampe à huile',
  scheme: 'dark',
  tokens: {
    bg: '#1C1814',
    surface: '#26201A',
    surfaceBorder: '#3B3329',
    ink: '#ECE3D2',
    inkMuted: '#B0A493',
    sage: '#82A892',
    leather: '#C2895C',
    gold: '#D4A84B',
    danger: '#CF7F7F',
    tableHeader: '#2D2720',
    tableZebra: '#221D17',
    shadowCard: '0 1px 3px rgba(0, 0, 0, 0.35), 0 2px 8px rgba(0, 0, 0, 0.25)',
    shadowHeader: '0 1px 0 rgba(59, 51, 41, 0.9), 0 2px 8px rgba(0, 0, 0, 0.3)',
    shadowElevated: '0 4px 16px rgba(0, 0, 0, 0.4)',
    shadowHover: '0 4px 12px rgba(0, 0, 0, 0.35)',
  },
  soft: Object.fromEntries(Object.entries(DISP_SOFT_PALETTES).map(([name, palette]) => [name, darkSoftColors(palette)])),
};
