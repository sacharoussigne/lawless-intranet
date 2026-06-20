import { getCareEpisode } from '@/app/_actions/cabinet/careEpisodes';
import { listConsultations } from '@/app/_actions/cabinet/consultations';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import { CareEpisodeDetailPageClient } from './CareEpisodeDetailPageClient';

export default async function CareEpisodeDetailPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string; patientId: string; episodeId: string }>;
}) {
  const { dispensarySlug, episodeId } = await params;

  const episodeResult = await getCareEpisode(dispensarySlug, episodeId);
  if (episodeResult.status === 404) notFound();
  if (episodeResult.status !== 200 || !('data' in episodeResult) || !episodeResult.data) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const consultationsResult = await listConsultations(dispensarySlug, episodeId);

  return (
    <CareEpisodeDetailPageClient
      dispensarySlug={dispensarySlug}
      episode={episodeResult.data}
      initialConsultations={
        consultationsResult.status === 200 && 'data' in consultationsResult
          ? consultationsResult.data ?? []
          : []
      }
    />
  );
}
