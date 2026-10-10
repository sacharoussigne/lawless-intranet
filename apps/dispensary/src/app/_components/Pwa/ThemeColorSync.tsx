'use client';

import { useEffect } from 'react';
import { useAppTheme } from '@lawless-intranet/host-kit/theme';
import { DISP_THEMES } from '@/lib/themes';

/**
 * The browser bar / iOS status bar follows the theme chosen in the app, not only
 * the device scheme: the `media` variants of the root layout are only a first guess.
 */
export function ThemeColorSync() {
  const { themeId } = useAppTheme();

  useEffect(() => {
    const color = DISP_THEMES.find((theme) => theme.id === themeId)?.tokens.bg;
    if (!color) return;
    document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((meta) => {
      meta.removeAttribute('media');
      meta.content = color;
    });
  }, [themeId]);

  return null;
}
