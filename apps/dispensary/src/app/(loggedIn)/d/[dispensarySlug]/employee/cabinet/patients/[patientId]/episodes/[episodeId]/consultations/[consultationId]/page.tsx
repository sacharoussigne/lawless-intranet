import { getConsultation } from '@/app/_actions/cabinet/consultations';
import { listConsultationDocuments } from '@/app/_actions/cabinet/consultationDocuments';
import { listConsultationDocumentTemplates } from '@/app/_actions/cabinet/consultationDocumentTemplates';
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

  const [documentsResult, templatesResult] = await Promise.all([
    listConsultationDocuments(dispensarySlug, consultationId),
    listConsultationDocumentTemplates(
      dispensarySlug,
      consultationResult.data.careEpisode.patient.cabinetId,
    ),
  ]);

  return (
    <ConsultationDetailPageClient
      dispensarySlug={dispensarySlug}
      consultation={consultationResult.data}
      initialDocuments={
        documentsResult.status === 200 && 'data' in documentsResult ? documentsResult.data : []
      }
      availableTemplates={
        templatesResult.status === 200 && 'data' in templatesResult ? templatesResult.data : []
      }
    />
  );
}
