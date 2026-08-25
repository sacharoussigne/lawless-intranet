'use client';

import { Container, SimpleGrid, Text } from '@mantine/core';
import { IconBuildingBank, IconClipboardList, IconDog, IconPaw, IconTemplate } from '@tabler/icons-react';
import { ModuleCard } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';

export default function EmployeeHubPage() {
  const t = useTenantRoutes();
  const { permissions, appSettings } = usePermissions();

  const cards = [];
  if (permissions?.bank.access && appSettings.featureBankEnabled) {
    cards.push({
      title: 'Banque',
      description: 'Comptes, semaines et transactions du refuge.',
      href: t.employee.bank,
      icon: IconBuildingBank,
    });
  }
  if (permissions?.animals.access) {
    cards.push({
      title: 'Animaux',
      description: 'Fiches, adoption et suivi des animaux du refuge.',
      href: t.employee.animals,
      icon: IconDog,
    });
  }
  if (permissions?.species.manage) {
    cards.push({
      title: 'Espèces',
      description: 'Espèces, races et variantes pour les animaux.',
      href: t.employee.species,
      icon: IconPaw,
    });
  }
  if (permissions?.documentTemplates.manage) {
    cards.push({
      title: 'Modèles de documents',
      description: 'Modèles pour générer des documents sur les fiches animal.',
      href: t.employee.templates,
      icon: IconTemplate,
    });
  }
  if (permissions?.waitlist.manage) {
    cards.push({
      title: 'File d’attente',
      description: 'Demandes d’animaux absents à faire arriver plus tard.',
      href: t.employee.waitlist,
      icon: IconClipboardList,
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
