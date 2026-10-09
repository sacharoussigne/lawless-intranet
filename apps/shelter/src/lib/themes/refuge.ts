import { lightSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { SHELTER_SOFT_PALETTES } from './palettes';

/**
 * « Refuge 1890 » : parchment, terracotta and charcoal, the original look.
 *
 * Two historical sets of values are kept so that it renders exactly as before:
 * the SCSS variables (`bg`, `surface`, `border`…) and the slightly different
 * values of the Mantine component styles (`ui*`, used through `shelterTokens`).
 */
export const refugeTheme: ThemeDefinition = {
  id: 'refuge',
  label: 'Refuge 1890',
  scheme: 'light',
  tokens: {
    bg: '#E8DCC8',
    bgAccent: '#DDD0B8',
    surface: '#FFFCF7',
    border: '#C9B496',
    ink: '#2F2C2A',
    muted: '#5A534C',
    terracotta: '#8B4532',
    sageDust: '#A4AC86',
    leather: '#8B5E3C',
    danger: '#8B2323',
    tableHeader: '#E0D3BC',
    tableZebra: '#F3EADF',
    shadowCard: '0 1px 2px rgba(62, 59, 57, 0.07), 0 3px 10px rgba(62, 59, 57, 0.06)',
    shadowHeader: '0 1px 0 rgba(201, 180, 150, 0.95), 0 2px 8px rgba(62, 59, 57, 0.06)',
    shadowSoft: '0 1px 2px rgba(62, 59, 57, 0.04)',

    uiBg: '#F0E6D6',
    uiSurface: '#FBF6EE',
    uiBorder: '#DCCBB3',
    uiInk: '#3E3B39',
    uiMuted: '#6A635C',
    uiTableHeader: '#E8DCC8',
    uiTableZebra: '#F5EDE0',
    uiShadowCard: '0 1px 2px rgba(62, 59, 57, 0.05), 0 2px 6px rgba(62, 59, 57, 0.04)',
    uiShadowHeader: '0 1px 0 rgba(220, 203, 179, 0.9), 0 2px 6px rgba(62, 59, 57, 0.04)',
    uiShadowElevated: '0 3px 12px rgba(62, 59, 57, 0.08)',
  },
  soft: Object.fromEntries(Object.entries(SHELTER_SOFT_PALETTES).map(([name, palette]) => [name, lightSoftColors(palette)])),
};
