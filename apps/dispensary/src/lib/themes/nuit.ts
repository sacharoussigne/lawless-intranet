import { darkSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { DISP_SOFT_PALETTES } from './palettes';

/**
 * « Lampe à huile » : warm dark, the same accents lightened for contrast.
 * Surfaces step up in lightness (bg → surface → surfaceRaised) so that cards,
 * nested cards and tables stand apart.
 */
export const nuitTheme: ThemeDefinition = {
  id: 'nuit',
  label: 'Lampe à huile',
  scheme: 'dark',
  tokens: {
    bg: '#14110E',
    surface: '#262019',
    surfaceRaised: '#30291F',
    surfaceBorder: '#4A4036',
    ink: '#ECE3D2',
    inkMuted: '#BFB3A1',
    sage: '#82A892',
    leather: '#C2895C',
    gold: '#D4A84B',
    danger: '#CF7F7F',
    tableHeader: '#342C23',
    tableZebra: '#2B241C',
    shadowXs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    shadowCard: '0 1px 3px rgba(0, 0, 0, 0.45), 0 2px 8px rgba(0, 0, 0, 0.35)',
    shadowHeader: '0 1px 0 rgba(74, 64, 54, 0.9), 0 2px 8px rgba(0, 0, 0, 0.4)',
    shadowElevated: '0 4px 16px rgba(0, 0, 0, 0.5)',
    shadowHover: '0 4px 12px rgba(0, 0, 0, 0.45)',
    shadowLg: '0 8px 24px rgba(0, 0, 0, 0.5)',
    shadowXl: '0 12px 32px rgba(0, 0, 0, 0.55)',
  },
  soft: Object.fromEntries(Object.entries(DISP_SOFT_PALETTES).map(([name, palette]) => [name, darkSoftColors(palette)])),
};
