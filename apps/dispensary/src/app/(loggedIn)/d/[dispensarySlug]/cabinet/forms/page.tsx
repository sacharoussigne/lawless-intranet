import { getCabinetPageBootstrap } from '@/app/_actions/cabinet/cabinets';
import { getCabinetFormSchemas } from '@/app/_actions/cabinet/formSchema';
import type { FormEntityType } from '@/lib/cabinet/formSchema';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { CabinetFormsPageClient } from './CabinetFormsPageClient';

function parseTab(value: string | undefined): FormEntityType {
  if (value === 'careEpisode' || value === 'consultation') return value;
  return 'patient';
}

export default async function CabinetFormsPage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ cabinetId?: string; tab?: string }>;
}) {
  const { dispensarySlug } = await params;
  const { cabinetId, tab } = await searchParams;
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

  const cabinet = bootstrap.cabinets.find((c) => c.id === cabinetId);
  if (!cabinet) {
    notFound();
  }

  const schemasResult = await getCabinetFormSchemas(dispensarySlug, cabinetId);
  if (schemasResult.status === 403) {
    redirect(`${t.cabinet.index}?cabinetId=${cabinetId}`);
  }
  if (schemasResult.status !== 200 || !('data' in schemasResult) || !schemasResult.data) {
    redirect(t.cabinet.index);
  }

  return (
    <CabinetFormsPageClient
      dispensarySlug={dispensarySlug}
      cabinets={bootstrap.cabinets}
      cabinetId={cabinetId}
      cabinetName={schemasResult.data.cabinetName}
      initialFormSchemas={schemasResult.data.formSchemas}
      initialTab={parseTab(tab)}
    />
  );
}
