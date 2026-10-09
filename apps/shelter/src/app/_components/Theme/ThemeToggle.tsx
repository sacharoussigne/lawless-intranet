'use client';

import { useEffect } from 'react';
import { ActionIcon, Tooltip } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { originOf, useAppTheme } from '@lawless-intranet/host-kit/theme';
import { getMyTheme } from '@/app/_actions/uiTheme';
import { SHELTER_DARK_THEME_ID, SHELTER_LIGHT_THEME_ID } from '@/lib/themes';

/**
 * Applies the theme saved in the account when this browser has another one
 * (new device, cleared cookies), without animation.
 */
function useAccountThemeSync() {
  const { setTheme } = useAppTheme();
  useEffect(() => {
    let cancelled = false;
    void getMyTheme()
      .then((result) => {
        if (!cancelled && 'data' in result && typeof result.data === 'string') {
          setTheme(result.data, { persist: false });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setTheme]);
}

/** Header sun / moon button: switches between the light and the dark theme, revealed from the button. */
export function ThemeToggle() {
  const { scheme, setTheme } = useAppTheme();
  useAccountThemeSync();
  const isDark = scheme === 'dark';
  const label = isDark ? 'Thème clair' : 'Thème sombre';

  return (
    <Tooltip label={label} position="bottom">
      <ActionIcon
        variant="light"
        size="lg"
        aria-label={label}
        onClick={(event) =>
          setTheme(isDark ? SHELTER_LIGHT_THEME_ID : SHELTER_DARK_THEME_ID, { origin: originOf(event.currentTarget) })
        }
      >
        {isDark ? <IconSun size={18} stroke={1.6} /> : <IconMoon size={18} stroke={1.6} />}
      </ActionIcon>
    </Tooltip>
  );
}
