'use client';

import { useEffect, useRef } from 'react';
import {
  MantineProvider,
  useMantineColorScheme,
  type MantineColorSchemeManager,
} from '@mantine/core';
import { ModalsProvider } from '@mantine/modals';
import { Notifications } from '@mantine/notifications';
import { ThemeProvider, useAppTheme } from '@lawless-intranet/host-kit/theme';
import theme, { shelterCssVariablesResolver } from '@/lib/theme';
import { SHELTER_THEME_CONFIG } from '@/lib/themes';
import { setMyTheme } from './_actions/uiTheme';

/**
 * Mantine reads its scheme from `<html>`, set before the first paint from the
 * theme cookie (no localStorage): the ThemeProvider owns the choice.
 */
const themeColorSchemeManager: MantineColorSchemeManager = {
  get: (defaultValue) => {
    if (typeof document === 'undefined') return defaultValue;
    const value = document.documentElement.getAttribute('data-mantine-color-scheme');
    return value === 'dark' || value === 'light' ? value : defaultValue;
  },
  set: () => undefined,
  subscribe: () => undefined,
  unsubscribe: () => undefined,
  clear: () => undefined,
};

/**
 * Keeps Mantine's color scheme in step with theme changes. Only reacts to a
 * change: during hydration the provider briefly reports the default theme,
 * while Mantine already read the right scheme from `<html>`.
 */
function MantineSchemeSync() {
  const { scheme } = useAppTheme();
  const { setColorScheme } = useMantineColorScheme();
  const previousScheme = useRef(scheme);
  useEffect(() => {
    if (previousScheme.current === scheme) return;
    previousScheme.current = scheme;
    setColorScheme(scheme);
  }, [scheme, setColorScheme]);
  return null;
}

export function MantineAppProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider config={SHELTER_THEME_CONFIG} onPersist={setMyTheme}>
      <MantineProvider
        theme={theme}
        cssVariablesResolver={shelterCssVariablesResolver}
        colorSchemeManager={themeColorSchemeManager}
      >
        <MantineSchemeSync />
        <Notifications />
        <ModalsProvider>{children}</ModalsProvider>
      </MantineProvider>
    </ThemeProvider>
  );
}
