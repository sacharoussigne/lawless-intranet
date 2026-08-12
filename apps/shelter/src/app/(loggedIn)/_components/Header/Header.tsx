'use client';

import { useState } from 'react';
import {
  Avatar,
  Button,
  Container,
  Group,
  Menu,
  Select,
  UnstyledButton,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import classes from './Header.module.scss';
import { authClient } from '@lawless-intranet/auth-client/browser';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { type AuthSession } from '@/types/session';
import { routes, tenantRoutes } from '@/types/routes';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { shelterSiteTitle } from '@/lib/appSettingsShared';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import { rewritePathWithShelterSlug } from '@/lib/shelter/slug';
import { IconArrowBackUp, IconLogout, IconSettings } from '@tabler/icons-react';

export default function Header({
  session,
  shelterSlug: shelterSlugProp,
  impersonatorDisplayName,
}: Readonly<{
  session: AuthSession | null;
  shelterSlug?: string;
  impersonatorDisplayName?: string | null;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const [stoppingImpersonation, setStoppingImpersonation] = useState(false);
  const { permissions, userRole, appSettings, accessibleShelters, shelterSlug: ctxSlug } =
    usePermissions();
  const shelterSlug = shelterSlugProp ?? ctxSlug;
  const t = shelterSlug ? tenantRoutes(shelterSlug) : null;
  const isPlatformAdminUser = isPlatformAdmin(session?.user?.role);
  const isImpersonating = Boolean(session?.session?.impersonatedBy);

  const handleShelterChange = (newSlug: string | null) => {
    if (!newSlug || !pathname) return;
    router.push(rewritePathWithShelterSlug(pathname, newSlug));
  };

  const handleLogout = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => {
          router.refresh();
        },
      },
    });
  };

  const handleStopImpersonating = async () => {
    setStoppingImpersonation(true);
    try {
      const result = await authClient.admin.stopImpersonating();
      if (result.error) {
        notifications.show({
          title: 'Erreur',
          message: result.error.message || 'Impossible de quitter la session impersonnée.',
          color: 'danger',
        });
        return;
      }
      notifications.show({
        title: 'Session restaurée',
        message: 'Vous êtes de nouveau connecté avec votre compte.',
        color: 'terracotta',
      });
      router.refresh();
      router.push(routes.platform.users);
    } catch {
      notifications.show({
        title: 'Erreur',
        message: 'Impossible de quitter la session impersonnée.',
        color: 'danger',
      });
    } finally {
      setStoppingImpersonation(false);
    }
  };

  const isActive = (route: string) =>
    Boolean(pathname && (pathname === route || pathname.startsWith(`${route}/`)));

  const avatarMenu = session ? (
    <Menu
      width={260}
      position="bottom-end"
      transitionProps={{ transition: 'pop-top-right' }}
      onClose={() => setUserMenuOpened(false)}
      onOpen={() => setUserMenuOpened(true)}
      withinPortal
    >
      <Menu.Target>
        <UnstyledButton className={userMenuOpened ? classes.userActive : undefined}>
          <Avatar
            alt={session.user.name}
            radius="xl"
            size={36}
            src={session.user.image ?? null}
          />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        {isPlatformAdminUser && (
          <>
            <Menu.Label>Plateforme</Menu.Label>
            <Menu.Item component={Link} href={routes.platform.shelters}>
              Refuges
            </Menu.Item>
            <Menu.Item component={Link} href={routes.platform.users}>
              Comptes utilisateurs
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        {hasRole(userRole, Role.ADMIN) && t && (
          <>
            <Menu.Label>Admin refuge</Menu.Label>
            <Menu.Item component={Link} href={t.admin.settings}>
              Paramètres du refuge
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
        <Menu.Item
          component={Link}
          href={routes.settings.index}
          leftSection={<IconSettings size={16} stroke={1.5} />}
        >
          Paramètres compte
        </Menu.Item>
        <Menu.Item
          leftSection={<IconLogout size={16} stroke={1.5} />}
          onClick={handleLogout}
        >
          Déconnexion
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  ) : null;

  return (
    <header className={`${classes.header} mb-8`}>
      <Container size="xl">
        <div className={classes.headerInner}>
          <Group gap="md" wrap="nowrap">
            <Link href={t?.employee.index ?? '/'} className={classes.brand}>
              {shelterSiteTitle(appSettings)}
            </Link>
            {session && accessibleShelters.length > 1 && (
              <Select
                aria-label="Refuge"
                data={accessibleShelters.map((s) => ({
                  value: s.slug,
                  label: s.name,
                }))}
                value={shelterSlug}
                onChange={handleShelterChange}
                allowDeselect={false}
                w={200}
                size="sm"
              />
            )}
          </Group>

          {session && t && (
            <nav className={classes.nav} aria-label="Navigation principale">
              {permissions?.bank.access && appSettings.featureBankEnabled && (
                <Link
                  href={t.employee.bank}
                  className={`${classes.navLink} ${isActive(t.employee.bank) ? classes.navLinkActive : ''}`}
                >
                  Banque
                </Link>
              )}
              {permissions?.species.manage && (
                <Link
                  href={t.employee.species}
                  className={`${classes.navLink} ${isActive(t.employee.species) ? classes.navLinkActive : ''}`}
                >
                  Espèces
                </Link>
              )}
              {isImpersonating && (
                <Button
                  color="leather"
                  variant="light"
                  leftSection={<IconArrowBackUp size={18} />}
                  loading={stoppingImpersonation}
                  onClick={handleStopImpersonating}
                >
                  {impersonatorDisplayName?.trim() || 'Compte'}
                </Button>
              )}
              {avatarMenu}
            </nav>
          )}

          {session && !t && (
            <Group gap="sm" wrap="nowrap">
              {isImpersonating && (
                <Button
                  color="leather"
                  variant="light"
                  leftSection={<IconArrowBackUp size={18} />}
                  loading={stoppingImpersonation}
                  onClick={handleStopImpersonating}
                >
                  {impersonatorDisplayName?.trim() || 'Compte'}
                </Button>
              )}
              {avatarMenu}
            </Group>
          )}
        </div>
      </Container>
    </header>
  );
}
