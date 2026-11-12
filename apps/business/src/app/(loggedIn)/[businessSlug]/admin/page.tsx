import { Container, SimpleGrid } from '@mantine/core';
import { ModuleCard } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { businessSiteTitle, getAppSettings } from '@/lib/appSettings';
import { getAuthSession } from '@/lib/authSession';
import { requireBusinessAccess } from '@/lib/business/context';
import { getAdminNavItems } from '@/lib/navigation/adminNav';
import { tenantRoutes } from '@/types/routes';

/** Admin tools of the business (reached from the avatar menu), shown for the enabled modules. */
export default async function AdminPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const session = await getAuthSession();
  const { business } = await requireBusinessAccess(session, businessSlug);
  const settings = await getAppSettings(business.id);

  return (
    <Container size="xl" py="xl">
      <PageHeader
        title="Administration"
        description={`Les outils d’administration du ${businessSiteTitle(settings)}.`}
      />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        {getAdminNavItems(tenantRoutes(businessSlug), settings).map((item) => (
          <ModuleCard
            key={item.id}
            title={item.label}
            description={item.description}
            icon={item.icon}
            href={item.href}
          />
        ))}
      </SimpleGrid>
    </Container>
  );
}
