import { getCabinetPageBootstrap } from '@/app/_actions/cabinet/cabinets';
import { listConsultationDocumentTemplates } from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { CabinetDocumentTemplatesPageClient } from './CabinetDocumentTemplatesPageClient';

export default async function CabinetTemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { businessSlug } = await params;
  const { cabinetId } = await searchParams;
  const t = tenantRoutes(businessSlug);

  if (!cabinetId) {
    redirect(t.cabinet.index);
  }

  const bootstrapResult = await getCabinetPageBootstrap(businessSlug);
  if (bootstrapResult.status !== 200 || !('data' in bootstrapResult) || !bootstrapResult.data) {
    redirect(t.employee.index);
  }

  const bootstrap = bootstrapResult.data;
  if (!bootstrap.hasAccess) {
    redirect(t.employee.index);
  }

  const cabinet = bootstrap.cabinets.find((item) => item.id === cabinetId);
  if (!cabinet) {
    notFound();
  }

  const templatesResult = await listConsultationDocumentTemplates(businessSlug, cabinetId);
  if (templatesResult.status === 403) {
    redirect(`${t.cabinet.index}?cabinetId=${cabinetId}`);
  }
  if (templatesResult.status !== 200 || !('data' in templatesResult) || !templatesResult.data) {
    redirect(`${t.cabinet.index}?cabinetId=${cabinetId}`);
  }

  return (
    <CabinetDocumentTemplatesPageClient
      businessSlug={businessSlug}
      cabinets={bootstrap.cabinets}
      cabinetId={cabinetId}
      initialTemplates={templatesResult.data}
    />
  );
}
