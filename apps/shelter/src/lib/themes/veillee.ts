import { darkSoftColors, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { SHELTER_SOFT_PALETTES } from './palettes';

const bg = '#16130F';
const surface = '#28221D';
const surfaceRaised = '#322B24';
const border = '#4B4239';
const ink = '#EDE3D4';
const muted = '#C0B4A2';
const tableHeader = '#362E27';
const tableZebra = '#2D2620';
const shadowCard = '0 1px 3px rgba(0, 0, 0, 0.45), 0 3px 10px rgba(0, 0, 0, 0.35)';
const shadowHeader = '0 1px 0 rgba(75, 66, 57, 0.9), 0 2px 8px rgba(0, 0, 0, 0.4)';

/**
 * « Veillée » : warm charcoal by the fire, terracotta and sage lightened for contrast.
 * Surfaces step up in lightness (bg → surface → surfaceRaised) so that cards,
 * nested cards and tables stand apart.
 */
export const veilleeTheme: ThemeDefinition = {
  id: 'veillee',
  label: 'Veillée',
  scheme: 'dark',
  tokens: {
    bg,
    bgAccent: '#1F1A16',
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
    shadowSoft: '0 1px 2px rgba(0, 0, 0, 0.4)',

    // The light theme's two historical sets collapse into one here.
    uiBg: bg,
    uiSurface: surface,
    uiSurfaceRaised: surfaceRaised,
    uiBorder: border,
    uiInk: ink,
    uiMuted: muted,
    uiTableHeader: tableHeader,
    uiTableZebra: tableZebra,
    uiShadowXs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    uiShadowCard: shadowCard,
    uiShadowHeader: shadowHeader,
    uiShadowElevated: '0 4px 16px rgba(0, 0, 0, 0.5)',
    uiShadowLg: '0 8px 24px rgba(0, 0, 0, 0.5)',
    uiShadowXl: '0 12px 32px rgba(0, 0, 0, 0.55)',
  },
  soft: Object.fromEntries(Object.entries(SHELTER_SOFT_PALETTES).map(([name, palette]) => [name, darkSoftColors(palette)])),
};
