import { redirect } from 'next/navigation';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { documentTemplatesManageAuth } from '@/lib/animals/documentsAuth';
import { tenantRoutes } from '@/types/routes';
import { TemplateFormPage } from '../TemplateFormPage';

async function NewTemplateContent({ shelterSlug }: { shelterSlug: string }) {
  const auth = await requireTenantServerActionContext(
    shelterSlug,
    documentTemplatesManageAuth,
  );
  if (!auth.ok) {
    redirect(tenantRoutes(shelterSlug).employee.index);
  }

  return <TemplateFormPage shelterSlug={shelterSlug} mode="create" />;
}

export default async function NewAnimalDocumentTemplatePage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <NewTemplateContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
