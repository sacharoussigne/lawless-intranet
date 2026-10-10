'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import { Avatar, Button, Card, Container, Group, Select, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconChevronRight, IconLogout, IconSettings } from '@tabler/icons-react';
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

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Group justify="space-between" wrap="nowrap" gap="md" mih={44}>
      <Text fw={600}>{label}</Text>
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

        <Card withBorder radius="md" padding="lg">
          <Stack gap="xs">
            <Row label="Thème">
              <ThemeSwitch />
            </Row>
            {accessibleDispensaries.length > 1 && (
              <Select
                label="Dispensaire"
                data={accessibleDispensaries.map((d) => ({ value: d.slug, label: d.name }))}
                value={dispensarySlug ?? null}
                onChange={(slug) => slug && pathname && router.push(rewritePathWithDispensarySlug(pathname, slug))}
                allowDeselect={false}
              />
            )}
          </Stack>
        </Card>

        <Card withBorder radius="md" padding={0}>
          <UnstyledButton component={Link} href={routes.settings.index} px="lg" py="md" w="100%">
            <Group justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                <IconSettings size={20} stroke={1.6} />
                <Text>Paramètres du compte</Text>
              </Group>
              <IconChevronRight size={18} stroke={1.6} />
            </Group>
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
