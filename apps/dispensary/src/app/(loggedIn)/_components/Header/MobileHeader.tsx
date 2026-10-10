'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ActionIcon, Text } from '@mantine/core';
import { IconArrowBackUp, IconChevronLeft } from '@tabler/icons-react';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { dispensarySiteTitle } from '@/lib/appSettingsShared';
import { getMobileSectionTitle } from '@/lib/navigation/mobileNav';
import { routes, tenantRoutes } from '@/types/routes';
import classes from './Header.module.scss';

type MobileHeaderProps = {
  /** Tenant of the page; null on account settings / platform pages. */
  dispensarySlug: string | null;
  /** Where the back arrow leads outside a tenant (the Profile tab of the default dispensary). */
  backHref: string | null;
  isImpersonating: boolean;
  stoppingImpersonation: boolean;
  onStopImpersonating: () => void;
};

/**
 * Compact app bar of the phone layout: logo and section title. Navigation lives
 * in the bottom tab bar, account actions in the Profile tab.
 */
export function MobileHeader({
  dispensarySlug,
  backHref,
  isImpersonating,
  stoppingImpersonation,
  onStopImpersonating,
}: MobileHeaderProps) {
  const pathname = usePathname() ?? '';
  const { appSettings } = usePermissions();
  const siteTitle = dispensarySiteTitle(appSettings);
  const t = dispensarySlug ? tenantRoutes(dispensarySlug) : null;
  const title = t
    ? getMobileSectionTitle(pathname, t, siteTitle)
    : pathname.startsWith(routes.settings.index)
      ? 'Paramètres du compte'
      : 'Dispensaire';

  return (
    <div className={classes.mobileBar}>
      {t ? (
        <Link href={t.employee.index} className={classes.mobileLogo} aria-label="Accueil">
          <Image src="/logo_dispensaire.png" alt="" width={34} height={34} style={{ borderRadius: '50%' }} />
        </Link>
      ) : backHref ? (
        <ActionIcon component={Link} href={backHref} variant="subtle" size="lg" aria-label="Retour">
          <IconChevronLeft size={24} />
        </ActionIcon>
      ) : null}
      <Text component="h1" className={classes.mobileTitle} truncate="end">
        {title}
      </Text>
      {isImpersonating && (
        <ActionIcon
          color="amber"
          variant="light"
          size="lg"
          loading={stoppingImpersonation}
          onClick={onStopImpersonating}
          aria-label="Revenir à mon compte"
        >
          <IconArrowBackUp size={20} />
        </ActionIcon>
      )}
    </div>
  );
}
