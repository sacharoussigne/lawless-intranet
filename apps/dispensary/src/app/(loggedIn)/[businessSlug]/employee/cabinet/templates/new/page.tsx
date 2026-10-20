import { TemplateFormPage } from '../TemplateFormPage';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function NewCabinetTemplatePage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { businessSlug } = await params;
  const { cabinetId } = await searchParams;

  if (!cabinetId) {
    redirect(tenantRoutes(businessSlug).cabinet.index);
  }

  return (
    <TemplateFormPage
      businessSlug={businessSlug}
      cabinetId={cabinetId}
      mode="create"
    />
  );
}
