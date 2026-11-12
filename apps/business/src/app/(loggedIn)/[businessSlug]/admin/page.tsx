import { Container, SimpleGrid } from '@mantine/core';
import { IconCalendar, IconMailbox, IconReplace, IconSettings, IconStethoscope } from '@tabler/icons-react';
import { ModuleCard, type ModuleCardProps } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { businessSiteTitle, getAppSettings, isAppFeatureEnabled } from '@/lib/appSettings';
import { getAuthSession } from '@/lib/authSession';
import { requireBusinessAccess } from '@/lib/business/context';
import { tenantRoutes } from '@/types/routes';

/** Admin tools of the business (reached from the avatar menu), shown for the enabled modules. */
export default async function AdminPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const t = tenantRoutes(businessSlug);
  const session = await getAuthSession();
  const { business } = await requireBusinessAccess(session, businessSlug);
  const settings = await getAppSettings(business.id);

  const sections: (ModuleCardProps & { visible: boolean })[] = [
    {
      title: 'Agendas',
      description: 'Créez les agendas partagés et choisissez qui peut les voir ou les modifier.',
      icon: IconCalendar,
      href: t.admin.agendas,
      visible: settings.featureAgendaEnabled,
    },
    {
      title: 'Cabinets',
      description: 'Créez les cabinets et gérez leurs membres.',
      icon: IconStethoscope,
      href: t.admin.cabinets,
      visible: isAppFeatureEnabled(settings, 'cabinet'),
    },
    {
      title: 'Boîtes aux lettres',
      description: 'Ouvrez une boîte aux lettres pour une personne et choisissez ses propriétaires.',
      icon: IconMailbox,
      href: t.admin.letterBoxes,
      visible: isAppFeatureEnabled(settings, 'letters'),
    },
    {
      title: 'Écraser les stocks',
      description: 'Remplacez les quantités du stock par un inventaire complet.',
      icon: IconReplace,
      href: t.admin.overwriteStock,
      visible: settings.featureStockEnabled,
    },
    {
      title: 'Paramètres du dispensaire',
      description: 'Identité, modules, membres, permissions et salaires.',
      icon: IconSettings,
      href: t.admin.settings,
      visible: true,
    },
  ];

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Administration"
        description={`Les outils d’administration du ${businessSiteTitle(settings)}.`}
      />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {sections
          .filter((section) => section.visible)
          .map(({ visible: _visible, ...section }) => (
            <ModuleCard key={section.title} {...section} />
          ))}
      </SimpleGrid>
    </Container>
  );
}
