'use client';

import { Container, SimpleGrid, Text } from '@mantine/core';
import { IconBuildingBank, IconSettings } from '@tabler/icons-react';
import { ModuleCard } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';

export default function EmployeeHubPage() {
  const t = useTenantRoutes();
  const { permissions, userRole, appSettings } = usePermissions();

  const cards = [];
  if (permissions?.bank.access && appSettings.featureBankEnabled) {
    cards.push({
      title: 'Banque',
      description: 'Comptes, semaines et transactions du refuge.',
      href: t.employee.bank,
      icon: IconBuildingBank,
    });
  }
  if (hasRole(userRole, Role.ADMIN)) {
    cards.push({
      title: 'Administration',
      description: 'Paramètres, membres et permissions.',
      href: t.admin.settings,
      icon: IconSettings,
    });
  }

  return (
    <Container size="xl">
      <PageHeader
        title="Accueil"
        description="Modules disponibles pour ce refuge."
      />
      {cards.length === 0 ? (
        <Text c="dimmed">Aucun module accessible pour votre rôle.</Text>
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
