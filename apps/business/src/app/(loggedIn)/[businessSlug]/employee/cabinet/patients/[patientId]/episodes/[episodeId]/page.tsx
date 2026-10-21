import { getCareEpisode } from '@/app/_actions/cabinet/careEpisodes';
import { listConsultations } from '@/app/_actions/cabinet/consultations';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { CareEpisodeDetailPageClient } from './CareEpisodeDetailPageClient';

export default async function CareEpisodeDetailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; patientId: string; episodeId: string }>;
}) {
  const { businessSlug, episodeId } = await params;

  const episodeResult = await getCareEpisode(businessSlug, episodeId);
  if (episodeResult.status === 404) notFound();
  if (episodeResult.status !== 200 || !('data' in episodeResult) || !episodeResult.data) {
    redirect(tenantRoutes(businessSlug).employee.index);
  }

  const consultationsResult = await listConsultations(businessSlug, episodeId);

  return (
    <CareEpisodeDetailPageClient
      businessSlug={businessSlug}
      episode={episodeResult.data}
      initialConsultations={
        consultationsResult.status === 200 && 'data' in consultationsResult
          ? consultationsResult.data ?? []
          : []
      }
    />
  );
}
