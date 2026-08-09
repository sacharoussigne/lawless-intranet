import { getConsultationDocumentTemplate } from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { getDataOrThrow } from '@/lib/response';
import { TemplateFormPage } from '../../TemplateFormPage';

async function EditCabinetTemplateContent({
  dispensarySlug,
  cabinetId,
  templateId,
}: {
  dispensarySlug: string;
  cabinetId: string;
  templateId: string;
}) {
  const templateResult = await getConsultationDocumentTemplate(dispensarySlug, {
    id: templateId,
  });

  if (templateResult.status === 404) {
    redirect(tenantRoutes(dispensarySlug).cabinet.templates(cabinetId));
  }

  const template = getDataOrThrow(
    templateResult,
    'Erreur lors du chargement du template',
  );

  if (template.cabinetId !== cabinetId) {
    redirect(tenantRoutes(dispensarySlug).cabinet.templates(cabinetId));
  }

  return (
    <TemplateFormPage
      dispensarySlug={dispensarySlug}
      cabinetId={cabinetId}
      mode="edit"
      template={template}
    />
  );
}

export default async function EditCabinetTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string; id: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { dispensarySlug, id } = await params;
  const { cabinetId } = await searchParams;

  if (!cabinetId) {
    redirect(tenantRoutes(dispensarySlug).cabinet.index);
  }

  return (
    <EditCabinetTemplateContent
      dispensarySlug={dispensarySlug}
      cabinetId={cabinetId}
      templateId={id}
    />
  );
}
