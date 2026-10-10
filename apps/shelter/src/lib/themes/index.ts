import { themesToCss, toThemeOptions, type ThemeConfig, type ThemeDefinition } from '@lawless-intranet/host-kit/theme';
import { refugeTheme } from './refuge';
import { veilleeTheme } from './veillee';

export const SHELTER_THEMES: readonly ThemeDefinition[] = [refugeTheme, veilleeTheme];

export const SHELTER_THEME_CONFIG: ThemeConfig = {
  prefix: 'shelter',
  defaultThemeId: refugeTheme.id,
  themes: toThemeOptions(SHELTER_THEMES),
};

/** Variables of every theme, injected once in the root layout. */
export const SHELTER_THEMES_CSS = themesToCss(SHELTER_THEMES, SHELTER_THEME_CONFIG);

export function isShelterThemeId(id: string): boolean {
  return SHELTER_THEMES.some((theme) => theme.id === id);
}

/** Pair used by the header toggle: the light and the dark theme. */
export const SHELTER_LIGHT_THEME_ID = refugeTheme.id;
export const SHELTER_DARK_THEME_ID = veilleeTheme.id;
