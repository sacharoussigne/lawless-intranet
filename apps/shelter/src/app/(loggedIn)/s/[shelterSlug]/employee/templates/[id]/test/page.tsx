import { notFound, redirect } from 'next/navigation';
import { getAnimalDocumentTemplate } from '@/app/_actions/animalDocumentTemplates';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { documentTemplatesManageAuth } from '@/lib/animals/documentsAuth';
import { tenantRoutes } from '@/types/routes';
import TestTemplatePageClient from './TestTemplatePageClient';

async function TestTemplateContent({
  shelterSlug,
  templateId,
}: {
  shelterSlug: string;
  templateId: string;
}) {
  const auth = await requireTenantServerActionContext(
    shelterSlug,
    documentTemplatesManageAuth,
  );
  if (!auth.ok) {
    redirect(tenantRoutes(shelterSlug).employee.index);
  }

  const result = await getAnimalDocumentTemplate(shelterSlug, { id: templateId });
  if (result.status === 404) notFound();
  if (result.status !== 200 || !('data' in result) || !result.data) {
    redirect(tenantRoutes(shelterSlug).employee.templates);
  }

  return <TestTemplatePageClient template={result.data} />;
}

export default async function TestAnimalDocumentTemplatePage({
  params,
}: {
  params: Promise<{ shelterSlug: string; id: string }>;
}) {
  const { shelterSlug, id } = await params;
  return (
    <SuspenseLoader>
      <TestTemplateContent shelterSlug={shelterSlug} templateId={id} />
    </SuspenseLoader>
  );
}
