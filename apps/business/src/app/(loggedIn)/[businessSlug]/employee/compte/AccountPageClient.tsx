'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Button, Card, Container, Divider, Group, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBuildingHospital, IconChevronRight, IconLogout, IconPalette, IconSettings } from '@tabler/icons-react';
import { authClient } from '@lawless-intranet/auth-client/browser';
import { ThemeSwitch } from '@/app/_components/Theme/ThemeMenuSwitch';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { businessSelectData, businessSwitchTarget } from '@/lib/business/switcher';
import { routes } from '@/types/routes';

type AccountPageClientProps = {
  name: string;
  email: string;
  image: string | null;
};

/** One line of the settings list: icon and label on the left, control on the right. */
function Row({ icon: Icon, label, children }: { icon: typeof IconSettings; label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md" mih={52} px="lg" w="100%">
      <Group gap="sm" wrap="nowrap">
        <Icon size={20} stroke={1.6} />
        <Text>{label}</Text>
      </Group>
      {children}
    </Group>
  );
}

export function AccountPageClient({ name, email, image }: AccountPageClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { accessibleBusinesses, businessSlug } = usePermissions();
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await authClient.signOut({ fetchOptions: { onSuccess: () => router.refresh() } });
    setLoggingOut(false);
  };

  return (
    <Container size="sm" py="md">
      <Stack gap="md">
        <Card withBorder radius="md" padding="lg">
          <Group wrap="nowrap" gap="md">
            <Avatar src={image} alt={name} size={64} radius="xl" />
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={700} size="lg" truncate="end">
                {name}
              </Text>
              <Text size="sm" c="dimmed" truncate="end">
                {email}
              </Text>
            </Stack>
          </Group>
        </Card>

        <Card withBorder radius="md" padding={0}>
          <Row icon={IconPalette} label="Thème">
            <ThemeSwitch />
          </Row>
          {accessibleBusinesses.length > 1 && (
            <>
              <Divider />
              <Row icon={IconBuildingHospital} label="Entreprise">
                <Select
                  aria-label="Entreprise"
                  w={170}
                  data={businessSelectData(accessibleBusinesses)}
                  value={businessSlug ?? null}
                  onChange={(slug) => {
                    if (!slug || !pathname) return;
                    const target = businessSwitchTarget(accessibleBusinesses, pathname, slug);
                    if (target.external) window.location.assign(target.href);
                    else router.push(target.href);
                  }}
                  allowDeselect={false}
                />
              </Row>
            </>
          )}
          <Divider />
          <UnstyledButton component={Link} href={routes.settings.index} w="100%">
            <Row icon={IconSettings} label="Paramètres du compte">
              <IconChevronRight size={18} stroke={1.6} />
            </Row>
          </UnstyledButton>
        </Card>

        <Button
          color="danger"
          variant="light"
          size="md"
          fullWidth
          leftSection={<IconLogout size={18} />}
          loading={loggingOut}
          onClick={() => void handleLogout()}
        >
          Déconnexion
        </Button>
      </Stack>
    </Container>
  );
}
