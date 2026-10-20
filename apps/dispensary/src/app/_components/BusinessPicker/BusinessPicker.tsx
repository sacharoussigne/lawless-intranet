'use client';

import { Anchor, Card, Container, Group, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconBuildingStore, IconChevronRight } from '@tabler/icons-react';
import Link from 'next/link';
import LogoutButton from '@/app/auth/no-access/LogoutButton';
import { businessTypes, getBusinessTypeDefinition, type BusinessType } from '@/lib/businessTypes';
import { routes, tenantRoutes } from '@/types/routes';
import type { AccessibleBusiness } from '@/types/permissions';

type BusinessPickerProps = {
  businesses: AccessibleBusiness[];
  /** Kind of business served by this host, null on the main host. */
  hostType: BusinessType | null;
  isPlatformAdmin: boolean;
};

function businessHref(business: AccessibleBusiness): string {
  return `${business.origin}${tenantRoutes(business.slug).employee.index}`;
}

/**
 * Root page: the businesses the user can open, grouped by kind (several), or a
 * welcome page explaining how to get access (none).
 */
export function BusinessPicker({ businesses, hostType, isPlatformAdmin }: BusinessPickerProps) {
  const types = (Object.keys(businessTypes) as BusinessType[]).filter(
    (type) => hostType === null || type === hostType,
  );
  const groups = types
    .map((type) => ({ type, items: businesses.filter((b) => b.type === type) }))
    .filter((group) => group.items.length > 0);

  return (
    <Container size="sm" py="10vh">
      <Stack gap="xl">
        <Stack gap={6} ta="center">
          <Title order={1} className="disp-display-title">
            {businesses.length > 0 ? 'Choisir une entreprise' : 'Bienvenue'}
          </Title>
          <Text c="dimmed">
            {businesses.length > 0
              ? 'Vous avez accès à plusieurs entreprises.'
              : `Cet intranet gère les ${types
                  .map((type) => getBusinessTypeDefinition(type).labelPlural.toLowerCase())
                  .join(', ')} du serveur.`}
          </Text>
        </Stack>

        {groups.map((group) => (
          <Stack key={group.type} gap="sm">
            <Text fw={600} size="sm" tt="uppercase" c="dimmed">
              {getBusinessTypeDefinition(group.type).labelPlural}
            </Text>
            <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="sm">
              {group.items.map((business) => (
                <Card
                  key={business.id}
                  component={Link}
                  href={businessHref(business)}
                  withBorder
                  radius="md"
                  padding="md"
                >
                  <Group justify="space-between" wrap="nowrap">
                    <Group gap="sm" wrap="nowrap">
                      <IconBuildingStore size={22} stroke={1.5} color="var(--disp-sage)" />
                      <div>
                        <Text fw={600}>{business.name}</Text>
                        <Text size="xs" c="dimmed">
                          {getBusinessTypeDefinition(business.type).label}
                        </Text>
                      </div>
                    </Group>
                    <IconChevronRight size={18} stroke={1.5} />
                  </Group>
                </Card>
              ))}
            </SimpleGrid>
          </Stack>
        ))}

        {businesses.length === 0 && (
          <Card withBorder radius="md" padding="lg" ta="center">
            <Text>
              Vous n&apos;êtes membre d&apos;aucune entreprise pour le moment. Demandez l&apos;accès à
              votre responsable, puis reconnectez-vous.
            </Text>
          </Card>
        )}

        <Stack gap="xs" align="center">
          {isPlatformAdmin && (
            <Anchor component={Link} href={routes.platform.businesses} size="sm">
              Administration de la plateforme
            </Anchor>
          )}
          <LogoutButton />
        </Stack>
      </Stack>
    </Container>
  );
}
