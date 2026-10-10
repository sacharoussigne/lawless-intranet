'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { getActiveMobileTab, getMobileTabs } from '@/lib/navigation/mobileNav';
import { tenantRoutes } from '@/types/routes';
import classes from './MobileTabBar.module.scss';

/** Bottom tab bar of the phone app (hidden from the `sm` breakpoint by CSS, no layout shift). */
export function MobileTabBar() {
  const pathname = usePathname();
  const { dispensarySlug, appSettings, permissions, agendaModuleAccess } = usePermissions();
  if (!dispensarySlug) return null;

  const t = tenantRoutes(dispensarySlug);
  const tabs = getMobileTabs({ t, appSettings, permissions, agendaModuleAccess });
  const active = pathname ? getActiveMobileTab(pathname, t) : null;

  return (
    <nav className={classes.bar} aria-label="Navigation principale">
      {tabs.map(({ id, label, href, icon: Icon }) => {
        const isActive = id === active;
        return (
          <Link
            key={id}
            href={href}
            className={`${classes.tab} ${isActive ? classes.tabActive : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            <Icon size={24} stroke={isActive ? 2 : 1.6} aria-hidden />
            <span className={classes.label}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
