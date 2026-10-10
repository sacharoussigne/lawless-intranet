'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Button, Card, Container, Divider, Group, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconBuildingHospital, IconChevronRight, IconLogout, IconPalette, IconSettings } from '@tabler/icons-react';
import { authClient } from '@lawless-intranet/auth-client/browser';
import { ThemeSwitch } from '@/app/_components/Theme/ThemeMenuSwitch';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { rewritePathWithDispensarySlug } from '@/lib/dispensary/slug';
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
  const { accessibleDispensaries, dispensarySlug } = usePermissions();
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
          {accessibleDispensaries.length > 1 && (
            <>
              <Divider />
              <Row icon={IconBuildingHospital} label="Dispensaire">
                <Select
                  aria-label="Dispensaire"
                  w={170}
                  data={accessibleDispensaries.map((d) => ({ value: d.slug, label: d.name }))}
                  value={dispensarySlug ?? null}
                  onChange={(slug) => slug && pathname && router.push(rewritePathWithDispensarySlug(pathname, slug))}
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
