import { themeAttribute, themeCookieName } from './css';
import type { ThemeConfig } from './types';

/**
 * Inline `<head>` script: applies the theme saved in the cookie before the
 * first paint (no flash of the default theme). Replaces Mantine's ColorSchemeScript.
 */
export function themeInitScript({ prefix, defaultThemeId, themes }: ThemeConfig): string {
  const schemes = Object.fromEntries(themes.map((theme) => [theme.id, theme.scheme]));
  return `(function(){try{var s=${JSON.stringify(schemes)};var m=document.cookie.match(/(?:^|; )${themeCookieName(prefix)}=([^;]+)/);var id=m?decodeURIComponent(m[1]):null;if(!id||!s[id])id=${JSON.stringify(defaultThemeId)};var d=document.documentElement;d.setAttribute(${JSON.stringify(themeAttribute(prefix))},id);d.setAttribute('data-mantine-color-scheme',s[id]);}catch(e){}})();`;
}
