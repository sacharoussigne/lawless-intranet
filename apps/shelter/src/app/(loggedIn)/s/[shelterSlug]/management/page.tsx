'use client';

import { Container, SimpleGrid, Text } from '@mantine/core';
import { IconPaw, IconSettings, IconTemplate } from '@tabler/icons-react';
import { ModuleCard } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';

export default function ManagementHubPage() {
  const t = useTenantRoutes();
  const { permissions, userRole } = usePermissions();

  const cards = [];
  if (permissions?.species.manage) {
    cards.push({
      title: 'Espèces',
      description: 'Espèces, races et variantes pour les animaux.',
      href: t.management.species,
      icon: IconPaw,
    });
  }
  if (permissions?.documentTemplates.manage) {
    cards.push({
      title: 'Modèles de documents',
      description: 'Modèles pour générer des documents sur les fiches animal.',
      href: t.management.templates,
      icon: IconTemplate,
    });
  }
  if (hasRole(userRole, Role.ADMIN)) {
    cards.push({
      title: 'Paramètres du refuge',
      description: 'Identité, modules et gestion des membres.',
      href: t.admin.settings,
      icon: IconSettings,
    });
  }

  return (
    <Container size="xl">
      <PageHeader
        title="Espace gestion"
        description="Configuration et administration du refuge."
      />
      {cards.length === 0 ? (
        <Text c="dimmed">Aucun module de gestion accessible pour votre rôle.</Text>
      ) : (
        <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="lg">
          {cards.map((card) => (
            <ModuleCard key={card.href} {...card} />
          ))}
        </SimpleGrid>
      )}
    </Container>
  );
}
