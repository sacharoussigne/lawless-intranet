import { lightSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { DISP_SOFT_PALETTES } from './palettes';

/** « Apothicaire » : cream paper and ink, the original look. */
export const apothecaryTheme: ThemeDefinition = {
  id: 'apothecary',
  label: 'Apothicaire',
  scheme: 'light',
  tokens: {
    bg: '#F7F3EB',
    surface: '#FFFCF6',
    surfaceBorder: '#E8DFD0',
    ink: '#3D3429',
    inkMuted: '#6B5F52',
    sage: '#4A6B5A',
    leather: '#8B5E3C',
    gold: '#B8860B',
    danger: '#9B4D4D',
    tableHeader: '#F0EBE3',
    tableZebra: '#FAF6EF',
    shadowCard: '0 1px 3px rgba(61, 52, 41, 0.06), 0 2px 8px rgba(61, 52, 41, 0.04)',
    shadowHeader: '0 1px 0 rgba(232, 223, 208, 0.8), 0 2px 8px rgba(61, 52, 41, 0.04)',
    shadowElevated: '0 4px 16px rgba(61, 52, 41, 0.08)',
    shadowHover: '0 4px 12px rgba(61, 52, 41, 0.08)',
  },
  soft: Object.fromEntries(Object.entries(DISP_SOFT_PALETTES).map(([name, palette]) => [name, lightSoftColors(palette)])),
};
