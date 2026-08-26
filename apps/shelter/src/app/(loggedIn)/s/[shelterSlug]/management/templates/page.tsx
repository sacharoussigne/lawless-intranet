import { redirect } from 'next/navigation';
import { listAnimalDocumentTemplates } from '@/app/_actions/animalDocumentTemplates';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { documentTemplatesManageAuth } from '@/lib/animals/documentsAuth';
import { tenantRoutes } from '@/types/routes';
import { AnimalDocumentTemplatesPageClient } from './AnimalDocumentTemplatesPageClient';

async function TemplatesContent({ shelterSlug }: { shelterSlug: string }) {
  const auth = await requireTenantServerActionContext(
    shelterSlug,
    documentTemplatesManageAuth,
  );
  if (!auth.ok) {
    redirect(tenantRoutes(shelterSlug).management.index);
  }

  const templatesResult = await listAnimalDocumentTemplates(shelterSlug);
  if (templatesResult.status === 403) {
    redirect(tenantRoutes(shelterSlug).management.index);
  }

  return (
    <AnimalDocumentTemplatesPageClient
      shelterSlug={shelterSlug}
      initialTemplates={
        templatesResult.status === 200 && 'data' in templatesResult
          ? (templatesResult.data ?? [])
          : []
      }
    />
  );
}

export default async function AnimalDocumentTemplatesPage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <TemplatesContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
