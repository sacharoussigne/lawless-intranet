'use client';

import { useEffect } from 'react';
import { Box, Group, Menu, SegmentedControl, Text, Tooltip, VisuallyHidden } from '@mantine/core';
import { IconMoon, IconSun } from '@tabler/icons-react';
import { useAppTheme } from '@lawless-intranet/host-kit/theme';
import { getMyTheme } from '@/app/_actions/uiTheme';
import { DISP_DARK_THEME_ID, DISP_LIGHT_THEME_ID } from '@/lib/themes';

/**
 * Applies the theme saved in the account when this browser has another one
 * (new device, cleared cookies), without animation. Mounted once by the header.
 */
export function AccountThemeSync() {
  const { setTheme } = useAppTheme();
  useEffect(() => {
    let cancelled = false;
    void getMyTheme()
      .then((result) => {
        if (!cancelled && 'data' in result && typeof result.data === 'string') {
          setTheme(result.data, { persist: false, animate: false });
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [setTheme]);
  return null;
}

function SwitchIcon({ icon: Icon, size, label }: { icon: typeof IconSun; size: number; label: string }) {
  return (
    <Tooltip label={label} withinPortal openDelay={400}>
      {/* Same box for both icons: equal segments, so the active indicator stays centered. */}
      <Box
        component="span"
        w={16}
        h={16}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <Icon size={size} stroke={1.6} aria-hidden />
        <VisuallyHidden>{label}</VisuallyHidden>
      </Box>
    </Tooltip>
  );
}

/** Icon-only light / dark switch, styled like the Employé / Gestion one. */
export function ThemeSwitch() {
  const { scheme, setTheme } = useAppTheme();
  return (
    <SegmentedControl
      size="xs"
      radius="xl"
      aria-label="Thème"
      value={scheme}
      onChange={(value) => setTheme(value === 'dark' ? DISP_DARK_THEME_ID : DISP_LIGHT_THEME_ID)}
      data={[
        // The sun's thin rays look smaller than the moon at the same size: optical balance.
        { value: 'light', label: <SwitchIcon icon={IconSun} size={16} label="Thème clair" /> },
        { value: 'dark', label: <SwitchIcon icon={IconMoon} size={14} label="Thème sombre" /> },
      ]}
    />
  );
}

/**
 * First row of the avatar menu: account name, theme switch on the right.
 * Not a Menu.Item, so the menu stays open during the theme reveal.
 */
export function AccountMenuHeader({ name }: { name?: string | null }) {
  return (
    <>
      <Group justify="space-between" wrap="nowrap" gap="sm" px="sm" py={6}>
        <Text size="sm" fw={600} truncate="end" style={{ minWidth: 0 }}>
          {name ?? 'Mon compte'}
        </Text>
        <ThemeSwitch />
      </Group>
      <Menu.Divider />
    </>
  );
}
