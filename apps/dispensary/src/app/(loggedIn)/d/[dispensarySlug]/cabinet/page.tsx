import { getCabinetPageBootstrap } from '@/app/_actions/cabinet/cabinets';
import { listCabinetPatients } from '@/app/_actions/cabinet/patients';
import { CabinetPageClient } from './CabinetPageClient';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function CabinetPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;

  const bootstrapResult = await getCabinetPageBootstrap(dispensarySlug);
  if (bootstrapResult.status !== 200) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const bootstrap =
    bootstrapResult.status === 200 && 'data' in bootstrapResult
      ? bootstrapResult.data
      : null;

  if (!bootstrap?.hasAccess) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const { cabinets, isAdmin } = bootstrap;
  const firstCabinetId = cabinets[0]?.id;

  const patientsResult = firstCabinetId
    ? await listCabinetPatients(dispensarySlug, { cabinetId: firstCabinetId })
    : { status: 200 as const, data: [] };

  return (
    <CabinetPageClient
      dispensarySlug={dispensarySlug}
      cabinets={cabinets}
      initialCabinetId={firstCabinetId ?? null}
      isAdmin={isAdmin}
      initialPatients={
        patientsResult.status === 200 && 'data' in patientsResult
          ? patientsResult.data ?? []
          : []
      }
    />
  );
}
