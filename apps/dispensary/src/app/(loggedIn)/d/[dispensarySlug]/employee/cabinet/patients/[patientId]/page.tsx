import { getCabinetPatient } from '@/app/_actions/cabinet/patients';
import { listCareEpisodes } from '@/app/_actions/cabinet/careEpisodes';
import { getAuthSession } from '@/lib/authSession';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { PatientDetailPageClient } from './PatientDetailPageClient';

export default async function PatientDetailPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string; patientId: string }>;
}) {
  const { dispensarySlug, patientId } = await params;

  const patientResult = await getCabinetPatient(dispensarySlug, patientId);
  if (patientResult.status === 404) notFound();
  if (patientResult.status !== 200 || !('data' in patientResult) || !patientResult.data) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const episodesResult = await listCareEpisodes(dispensarySlug, patientId);

  return (
    <PatientDetailPageClient
      dispensarySlug={dispensarySlug}
      patient={patientResult.data}
      initialEpisodes={
        episodesResult.status === 200 && 'data' in episodesResult
          ? episodesResult.data ?? []
          : []
      }
    />
  );
}
