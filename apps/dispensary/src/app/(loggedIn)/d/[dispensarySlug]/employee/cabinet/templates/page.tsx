import { getCabinetPageBootstrap } from '@/app/_actions/cabinet/cabinets';
import { listConsultationDocumentTemplates } from '@/app/_actions/cabinet/consultationDocumentTemplates';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { CabinetDocumentTemplatesPageClient } from './CabinetDocumentTemplatesPageClient';

export default async function CabinetTemplatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ cabinetId?: string }>;
}) {
  const { dispensarySlug } = await params;
  const { cabinetId } = await searchParams;
  const t = tenantRoutes(dispensarySlug);

  if (!cabinetId) {
    redirect(t.cabinet.index);
  }

  const bootstrapResult = await getCabinetPageBootstrap(dispensarySlug);
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

  const templatesResult = await listConsultationDocumentTemplates(dispensarySlug, cabinetId);
  if (templatesResult.status === 403) {
    redirect(`${t.cabinet.index}?cabinetId=${cabinetId}`);
  }
  if (templatesResult.status !== 200 || !('data' in templatesResult) || !templatesResult.data) {
    redirect(`${t.cabinet.index}?cabinetId=${cabinetId}`);
  }

  return (
    <CabinetDocumentTemplatesPageClient
      dispensarySlug={dispensarySlug}
      cabinets={bootstrap.cabinets}
      cabinetId={cabinetId}
      initialTemplates={templatesResult.data}
    />
  );
}
