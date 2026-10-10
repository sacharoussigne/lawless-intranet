import { THEME_TRANSITION_CSS } from './transition';
import type { SoftColors, ThemeConfig, ThemeDefinition, ThemePalette } from './types';

export function themeAttribute(prefix: string): string {
  return `data-${prefix}-theme`;
}

export function themeCookieName(prefix: string): string {
  return `${prefix}-theme`;
}

/** Tints of a light theme: the palette's own light shades. */
export function lightSoftColors(palette: ThemePalette): SoftColors {
  return { soft: palette[0], strong: palette[1], border: palette[3], text: palette[8] };
}

/** Tints of a dark theme: translucent mid shades over the dark surface, light text. */
export function darkSoftColors(palette: ThemePalette): SoftColors {
  return {
    soft: `color-mix(in srgb, ${palette[5]} 14%, transparent)`,
    strong: `color-mix(in srgb, ${palette[5]} 24%, transparent)`,
    border: `color-mix(in srgb, ${palette[4]} 45%, transparent)`,
    text: palette[2],
  };
}

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

/** CSS variables of a theme, as `[name, value]` pairs. */
export function themeVariables(theme: ThemeDefinition, prefix: string): [string, string][] {
  const tokens = Object.entries(theme.tokens).map(([name, value]): [string, string] => [`--${prefix}-${kebab(name)}`, value]);
  const soft = Object.entries(theme.soft).flatMap(([name, colors]): [string, string][] => [
    [`--${prefix}-${name}-soft`, colors.soft],
    [`--${prefix}-${name}-soft-strong`, colors.strong],
    [`--${prefix}-${name}-soft-border`, colors.border],
    [`--${prefix}-${name}-soft-text`, colors.text],
  ]);
  return [['color-scheme', theme.scheme], ...tokens, ...soft];
}

/**
 * CSS rule of a theme: `:root[data-<prefix>-theme="<id>"] { … }`. The default
 * theme also applies to `:root`, before the attribute is set.
 */
export function themeToCss(theme: ThemeDefinition, { prefix, isDefault = false }: { prefix: string; isDefault?: boolean }): string {
  const selector = `:root[${themeAttribute(prefix)}="${theme.id}"]`;
  const body = themeVariables(theme, prefix)
    .map(([name, value]) => `  ${name}: ${value};`)
    .join('\n');
  return `${isDefault ? ':root,\n' : ''}${selector} {\n${body}\n}`;
}

/** CSS of every predefined theme (the default one first) and of the switch animation. */
export function themesToCss(themes: readonly ThemeDefinition[], config: Pick<ThemeConfig, 'prefix' | 'defaultThemeId'>): string {
  const ordered = [...themes].sort((a, b) => Number(b.id === config.defaultThemeId) - Number(a.id === config.defaultThemeId));
  const rules = ordered.map((theme) => themeToCss(theme, { prefix: config.prefix, isDefault: theme.id === config.defaultThemeId }));
  return [...rules, THEME_TRANSITION_CSS].join('\n\n');
}

export function toThemeOptions(themes: readonly ThemeDefinition[]) {
  return themes.map(({ id, label, scheme }) => ({ id, label, scheme }));
}
