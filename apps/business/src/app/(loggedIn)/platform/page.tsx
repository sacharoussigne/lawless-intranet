import { Container, SimpleGrid } from '@mantine/core';
import { IconBuildingStore, IconListDetails, IconUsers } from '@tabler/icons-react';
import { ModuleCard } from '@/app/_components/ModuleCard/ModuleCard';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { routes } from '@/types/routes';

/** Platform tools (reached from the avatar menu); the /platform guard keeps it to platform admins. */
export default function PlatformPage() {
  return (
    <Container size="xl" py="xl">
      <PageHeader title="Plateforme" description="Administration de toutes les entreprises de l’intranet." />
      <SimpleGrid cols={{ base: 1, sm: 2, lg: 3 }} spacing="lg">
        <ModuleCard
          title="Entreprises"
          description="Créez les entreprises, choisissez leur type et leurs modules."
          icon={IconBuildingStore}
          href={routes.platform.businesses}
        />
        <ModuleCard
          title="Comptes utilisateurs"
          description="Comptes de l’intranet, rôles globaux et accès aux entreprises."
          icon={IconUsers}
          href={routes.platform.users}
        />
        <ModuleCard
          title="Logs"
          description="Journal des actions, des erreurs et des requêtes du bot."
          icon={IconListDetails}
          href={routes.platform.logs}
        />
      </SimpleGrid>
    </Container>
  );
}
