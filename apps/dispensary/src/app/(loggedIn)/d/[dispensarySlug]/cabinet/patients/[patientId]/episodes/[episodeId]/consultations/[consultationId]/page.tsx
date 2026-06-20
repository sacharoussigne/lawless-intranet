import { getConsultation } from '@/app/_actions/cabinet/consultations';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { ConsultationDetailPageClient } from './ConsultationDetailPageClient';

export default async function ConsultationDetailPage({
  params,
}: {
  params: Promise<{
    dispensarySlug: string;
    patientId: string;
    episodeId: string;
    consultationId: string;
  }>;
}) {
  const { dispensarySlug, consultationId } = await params;

  const consultationResult = await getConsultation(dispensarySlug, consultationId);
  if (consultationResult.status === 404) notFound();
  if (
    consultationResult.status !== 200 ||
    !('data' in consultationResult) ||
    !consultationResult.data
  ) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  return (
    <ConsultationDetailPageClient
      dispensarySlug={dispensarySlug}
      consultation={consultationResult.data}
    />
  );
}
