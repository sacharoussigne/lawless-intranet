import { getCabinetPatient } from '@/app/_actions/cabinet/patients';
import { listCareEpisodes } from '@/app/_actions/cabinet/careEpisodes';
import { getAuthSession } from '@/lib/authSession';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { isDispensaryAdminRole, canEditCabinetFormSchema } from '@/lib/cabinet/access';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import type { AuthSession } from '@/types/session';
import { PatientDetailPageClient } from './PatientDetailPageClient';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string; patientId: string }>;
}) {
  const { dispensarySlug, patientId } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForDispensary(
    session as AuthSession | null,
    dispensary.id,
  );

  const patientResult = await getCabinetPatient(dispensarySlug, patientId);
  if (patientResult.status === 404) notFound();
  if (patientResult.status !== 200 || !('data' in patientResult) || !patientResult.data) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const episodesResult = await listCareEpisodes(dispensarySlug, patientId);

  const userId = session?.user?.id;
  const canEditSchema =
    userId && patientResult.data
      ? await canEditCabinetFormSchema(
          dispensary.id,
          patientResult.data.cabinetId,
          userId,
          session?.user?.role,
          effectiveRole,
        )
      : false;

  return (
    <PatientDetailPageClient
      dispensarySlug={dispensarySlug}
      patient={patientResult.data}
      initialEpisodes={
        episodesResult.status === 200 && 'data' in episodesResult
          ? episodesResult.data ?? []
          : []
      }
      isAdmin={isDispensaryAdminRole(session?.user?.role, effectiveRole)}
      canEditSchema={canEditSchema}
    />
  );
}
