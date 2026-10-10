import { describe, expect, it } from 'vitest';
import { darkSoftColors, lightSoftColors, themesToCss, themeToCss, type ThemeDefinition, type ThemePalette } from './index';
import { themeInitScript } from './script';
import { THEME_TRANSITION_CSS } from './transition';

const palette: ThemePalette = ['#000', '#111', '#222', '#333', '#444', '#555', '#666', '#777', '#888', '#999'];

const light: ThemeDefinition = {
  id: 'clair',
  label: 'Clair',
  scheme: 'light',
  tokens: { surface: '#fff', inkMuted: '#666' },
  soft: { sage: lightSoftColors(palette) },
};
const dark: ThemeDefinition = { ...light, id: 'nuit', label: 'Nuit', scheme: 'dark', soft: { sage: darkSoftColors(palette) } };

describe('themeToCss', () => {
  it('writes the scoped rule with tokens and soft colors', () => {
    const css = themeToCss(light, { prefix: 'disp' });
    expect(css.startsWith(':root[data-disp-theme="clair"] {')).toBe(true);
    expect(css).toContain('color-scheme: light;');
    expect(css).toContain('--disp-surface: #fff;');
    expect(css).toContain('--disp-ink-muted: #666;');
    expect(css).toContain('--disp-sage-soft: #000;');
    expect(css).toContain('--disp-sage-soft-strong: #111;');
    expect(css).toContain('--disp-sage-soft-border: #333;');
    expect(css).toContain('--disp-sage-soft-text: #888;');
  });

  it('applies the default theme to :root too, first', () => {
    const css = themesToCss([dark, light], { prefix: 'disp', defaultThemeId: 'clair' });
    expect(css.startsWith(':root,\n:root[data-disp-theme="clair"]')).toBe(true);
    expect(css).toContain(':root[data-disp-theme="nuit"] {');
    expect(css).toContain('color-scheme: dark;');
    expect(css).toContain('--disp-sage-soft: color-mix(in srgb, #555 14%, transparent);');
  });
});

describe('themeInitScript', () => {
  it('embeds the cookie, the schemes and the default', () => {
    const script = themeInitScript({ prefix: 'disp', defaultThemeId: 'clair', themes: [light, dark] });
    expect(script).toContain('disp-theme=');
    expect(script).toContain('{"clair":"light","nuit":"dark"}');
    expect(script).toContain('"data-disp-theme"');
    expect(script).toContain('id="clair"');
  });
});

describe('theme transition CSS', () => {
  it('is included with the themes and reveals from the top right corner', () => {
    const css = themesToCss([light], { prefix: 'disp', defaultThemeId: 'clair' });
    expect(css).toContain(THEME_TRANSITION_CSS);
    expect(THEME_TRANSITION_CSS).toContain('circle(0% at 100% 0%)');
    expect(THEME_TRANSITION_CSS).toContain(':root[data-theme-transition]::view-transition-new(root)');
  });
});
