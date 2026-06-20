import { TemplateFormPage } from '../TemplateFormPage';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function NewCabinetTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { dispensarySlug } = await params;
  const { cabinetId } = await searchParams;

  if (!cabinetId) {
    redirect(tenantRoutes(dispensarySlug).cabinet.index);
  }

  return (
    <TemplateFormPage
      dispensarySlug={dispensarySlug}
      cabinetId={cabinetId}
      mode="create"
    />
  );
}
