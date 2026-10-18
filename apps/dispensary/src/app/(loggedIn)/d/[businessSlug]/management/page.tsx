import { tenantRoutes } from '@/types/routes';
import { Container, SimpleGrid } from '@mantine/core';
import {
  IconArchive,
  IconBottle,
  IconBuildingStore,
  IconSettings,
  IconClipboardText,
  IconUsers,
} from '@tabler/icons-react';
import { getAuthSession } from '@/lib/authSession';
import { can, hasRole } from '@lawless-intranet/auth-permissions';
import { Role } from '@/types/enum/roles';
import { businessSiteTitle, getAppSettings } from '@/lib/appSettings';
import { requireBusinessAccess } from '@/lib/business/context';
import { ModuleCard, type ModuleCardProps } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';

export default async function ManagementPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const t = tenantRoutes(businessSlug);
  const session = await getAuthSession();
  const { business, effectivePermissions } = await requireBusinessAccess(session, businessSlug);
  const settings = await getAppSettings(business.id);
  const showAdminSettings = hasRole(session?.user?.role, Role.ADMIN);
  const siteTitle = businessSiteTitle(settings);

  const managementSections: (ModuleCardProps & { visible: boolean })[] = [
    {
      title: 'Objets',
      description:
        "Créez et organisez les objets et leurs catégories pour structurer le stock du dispensaire.",
      icon: IconBottle,
      href: t.management.items(),
      visible: true,
    },
    {
      title: 'Coffres',
      description:
        'Configurez les coffres de stockage, leur ordre et leur organisation physique.',
      icon: IconArchive,
      href: t.management.chests,
      visible: true,
    },
    {
      title: 'Entreprises',
      description:
        'Gérez le référentiel des entreprises partenaires et leurs regroupements par structure.',
      icon: IconBuildingStore,
      href: t.management.companies(),
      visible: true,
    },
    {
      title: 'Personnes',
      description:
        'Fixez le nom des personnes, avec ou sans compte intranet, et ajoutez-en à partir de leur Discord ID.',
      icon: IconUsers,
      href: t.management.people,
      visible:
        settings.featureWeeklyDispensaryActivityEnabled &&
        can(effectivePermissions, 'weekly_dispensary_activity', 'edit_all'),
    },
    {
      title: 'Courriers',
      description:
        'Gérez les courriers utilisés pour les entreprises et le suivi administratif.',
      icon: IconClipboardText,
      href: t.management.mails,
      visible: settings.featureMailsEnabled,
    },
  ];

  const visibleSections = managementSections.filter((s) => s.visible);

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Espace gestion"
        description={`Retrouvez ici toutes les actions de configuration et d’administration du ${siteTitle}.`}
      />

      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {visibleSections.map(({ visible: _visible, ...section }) => (
          <ModuleCard key={section.title} {...section} />
        ))}
        {showAdminSettings && (
          <ModuleCard
            title="Paramètres du dispensaire"
            description="Identité, modules employés et gestion des membres."
            icon={IconSettings}
            href={t.admin.settings}
          />
        )}
      </SimpleGrid>
    </Container>
  );
}
