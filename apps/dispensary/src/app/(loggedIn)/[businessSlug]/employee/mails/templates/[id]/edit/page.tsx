import { getUserMailTemplateById } from '@/app/_actions/mailTemplates';
import EditTemplatePageClient from './EditTemplatePageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

async function EditTemplateContent({
  businessSlug,
  templateId,
}: {
  businessSlug: string;
  templateId: string;
}) {
  const templateResult = await getUserMailTemplateById(businessSlug, {
    id: templateId,
  });

  if (templateResult.status === 404) {
    redirect(tenantRoutes(businessSlug).employee.mails);
  }

  const template = getDataOrThrow(
    templateResult,
    'Erreur lors du chargement du template',
  );

  return <EditTemplatePageClient template={template} />;
}

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ businessSlug: string; id: string }>;
}) {
  const { businessSlug, id } = await params;

  return (
    <SuspenseLoader>
      <EditTemplateContent businessSlug={businessSlug} templateId={id} />
    </SuspenseLoader>
  );
}
