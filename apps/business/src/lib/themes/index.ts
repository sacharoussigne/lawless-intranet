import { themesToCss, toThemeOptions, type ThemeConfig, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { apothecaryTheme } from './apothecary';
import { nuitTheme } from './nuit';

export const DISP_THEMES: readonly ThemeDefinition[] = [apothecaryTheme, nuitTheme];

export const DISP_THEME_CONFIG: ThemeConfig = {
  prefix: 'disp',
  defaultThemeId: apothecaryTheme.id,
  themes: toThemeOptions(DISP_THEMES),
};

/** Variables of every theme, injected once in the root layout. */
export const DISP_THEMES_CSS = themesToCss(DISP_THEMES, DISP_THEME_CONFIG);

export function isDispThemeId(id: string): boolean {
  return DISP_THEMES.some((theme) => theme.id === id);
}

/** Pairs used by the header toggle: the light and the dark theme. */
export const DISP_LIGHT_THEME_ID = apothecaryTheme.id;
export const DISP_DARK_THEME_ID = nuitTheme.id;
