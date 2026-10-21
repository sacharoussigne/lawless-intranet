import { getConsultationDocumentTemplate } from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { getDataOrThrow } from '@/lib/response';
import { TemplateFormPage } from '../../TemplateFormPage';

async function EditCabinetTemplateContent({
  businessSlug,
  cabinetId,
  templateId,
}: {
  businessSlug: string;
  cabinetId: string;
  templateId: string;
}) {
  const templateResult = await getConsultationDocumentTemplate(businessSlug, {
    id: templateId,
  });

  if (templateResult.status === 404) {
    redirect(tenantRoutes(businessSlug).cabinet.templates(cabinetId));
  }

  const template = getDataOrThrow(
    templateResult,
    'Erreur lors du chargement du template',
  );

  if (template.cabinetId !== cabinetId) {
    redirect(tenantRoutes(businessSlug).cabinet.templates(cabinetId));
  }

  return (
    <TemplateFormPage
      businessSlug={businessSlug}
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
  params: Promise<{ businessSlug: string; id: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { businessSlug, id } = await params;
  const { cabinetId } = await searchParams;

  if (!cabinetId) {
    redirect(tenantRoutes(businessSlug).cabinet.index);
  }

  return (
    <EditCabinetTemplateContent
      businessSlug={businessSlug}
      cabinetId={cabinetId}
      templateId={id}
    />
  );
}
