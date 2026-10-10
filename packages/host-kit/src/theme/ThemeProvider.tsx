'use client';

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import { themeAttribute, themeCookieName } from './css';
import { switchThemeWithTransition } from './transition';
import type { ThemeConfig, ThemeOption, ThemeScheme } from './types';

const COOKIE_MAX_AGE_S = 60 * 60 * 24 * 365;

type SetThemeOptions = {
  /** Circular reveal from the top right corner (default true). */
  animate?: boolean;
  /** Saves the choice in the account (default true). */
  persist?: boolean;
};

type AppThemeContext = {
  themeId: string;
  scheme: ThemeScheme;
  themes: readonly ThemeOption[];
  setTheme: (id: string, options?: SetThemeOptions) => void;
};

const Context = createContext<AppThemeContext | null>(null);

/**
 * Current theme = the `data-<prefix>-theme` attribute of `<html>`, set before
 * the first paint by `themeInitScript`. The provider reads it as an external
 * store, switches it (cookie + attributes, animated) and persists the choice.
 */
export function ThemeProvider({
  config,
  onPersist,
  children,
}: {
  config: ThemeConfig;
  /** Saves the theme in the user's account (server action). */
  onPersist?: (themeId: string) => unknown;
  children: ReactNode;
}) {
  const { prefix, defaultThemeId, themes } = config;

  const store = useMemo(() => {
    const listeners = new Set<() => void>();
    const isKnown = (id: string | null): id is string => id !== null && themes.some((theme) => theme.id === id);
    return {
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      get() {
        const id = document.documentElement.getAttribute(themeAttribute(prefix));
        return isKnown(id) ? id : defaultThemeId;
      },
      emit() {
        listeners.forEach((listener) => listener());
      },
      isKnown,
    };
  }, [prefix, defaultThemeId, themes]);

  const themeId = useSyncExternalStore(store.subscribe, store.get, () => defaultThemeId);
  const scheme = themes.find((theme) => theme.id === themeId)?.scheme ?? 'light';

  const setTheme = useCallback(
    (id: string, { animate = true, persist = true }: SetThemeOptions = {}) => {
      if (!store.isKnown(id) || id === store.get()) return;
      const nextScheme = themes.find((theme) => theme.id === id)?.scheme ?? 'light';
      switchThemeWithTransition(() => {
        const root = document.documentElement;
        root.setAttribute(themeAttribute(prefix), id);
        root.setAttribute('data-mantine-color-scheme', nextScheme);
        document.cookie = `${themeCookieName(prefix)}=${encodeURIComponent(id)}; path=/; max-age=${COOKIE_MAX_AGE_S}; SameSite=Lax`;
        // React (icons, Mantine scheme) updates inside the transition snapshot.
        flushSync(() => store.emit());
      }, animate);
      if (persist) void Promise.resolve(onPersist?.(id)).catch(() => undefined);
    },
    [onPersist, prefix, store, themes],
  );

  const value = useMemo(() => ({ themeId, scheme, themes, setTheme }), [themeId, scheme, themes, setTheme]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useAppTheme(): AppThemeContext {
  const context = useContext(Context);
  if (!context) throw new Error('useAppTheme must be used inside ThemeProvider');
  return context;
}
