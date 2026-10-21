'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Tabs } from '@mantine/core';
import type { Icon } from '@tabler/icons-react';

export type SectionTab = { id: string; label: string; href: string; icon: Icon };

function isTabActive(pathname: string | null, href: string): boolean {
  return pathname === href || (pathname?.startsWith(`${href}/`) ?? false);
}

/**
 * Tabs of a section whose pages keep their own URL (e.g. Stock: inventory,
 * movements, statistics). Each tab is a real link (middle-click, bookmarks);
 * nothing is rendered with fewer than two tabs.
 */
export function SectionTabs({ tabs, label }: { tabs: readonly SectionTab[]; label: string }) {
  const pathname = usePathname();
  if (tabs.length < 2) return null;
  const active = tabs.find((tab) => isTabActive(pathname, tab.href))?.id ?? null;

  return (
    // Navigation happens through the links: arrow keys only move focus.
    <Tabs value={active} activateTabWithKeyboard={false} aria-label={label}>
      <Tabs.List>
        {tabs.map(({ id, label: tabLabel, href, icon: TabIcon }) => (
          <Tabs.Tab
            key={id}
            value={id}
            leftSection={<TabIcon size={16} stroke={1.6} />}
            renderRoot={(props) => <Link {...props} href={href} />}
          >
            {tabLabel}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}
