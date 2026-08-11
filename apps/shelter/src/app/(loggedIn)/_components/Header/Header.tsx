'use client';

import { useState } from 'react';
import { Avatar, Button, Container, Group, Menu, Select, UnstyledButton } from '@mantine/core';
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
import { IconLogout } from '@tabler/icons-react';

export default function Header({
  session,
  shelterSlug: shelterSlugProp,
}: Readonly<{
  session: AuthSession | null;
  shelterSlug?: string;
}>) {
  const router = useRouter();
  const pathname = usePathname();
  const [userMenuOpened, setUserMenuOpened] = useState(false);
  const { permissions, userRole, appSettings, accessibleShelters, shelterSlug: ctxSlug } =
    usePermissions();
  const shelterSlug = shelterSlugProp ?? ctxSlug;
  const t = shelterSlug ? tenantRoutes(shelterSlug) : null;
  const isPlatformAdminUser = isPlatformAdmin(session?.user?.role);

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

  const isActive = (route: string) =>
    Boolean(pathname && (pathname === route || pathname.startsWith(`${route}/`)));

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
                      <Menu.Divider />
                    </>
                  )}
                  {hasRole(userRole, Role.ADMIN) && (
                    <>
                      <Menu.Label>Admin refuge</Menu.Label>
                      <Menu.Item component={Link} href={t.admin.settings}>
                        Paramètres du refuge
                      </Menu.Item>
                      <Menu.Divider />
                    </>
                  )}
                  <Menu.Item
                    leftSection={<IconLogout size={16} stroke={1.5} />}
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </nav>
          )}

          {session && !t && (
            <Group gap="sm" wrap="nowrap">
              {isPlatformAdminUser && (
                <Button component={Link} href={routes.platform.shelters} variant="light">
                  Refuges
                </Button>
              )}
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
                      <Menu.Divider />
                    </>
                  )}
                  <Menu.Item
                    leftSection={<IconLogout size={16} stroke={1.5} />}
                    onClick={handleLogout}
                  >
                    Déconnexion
                  </Menu.Item>
                </Menu.Dropdown>
              </Menu>
            </Group>
          )}
        </div>
      </Container>
    </header>
  );
}
