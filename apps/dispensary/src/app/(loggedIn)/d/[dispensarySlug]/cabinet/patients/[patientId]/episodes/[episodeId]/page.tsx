import { getCareEpisode } from '@/app/_actions/cabinet/careEpisodes';
import { listConsultations } from '@/app/_actions/cabinet/consultations';
import { getAuthSession } from '@/lib/authSession';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import type { AuthSession } from '@/types/session';
import { CareEpisodeDetailPageClient } from './CareEpisodeDetailPageClient';

export default async function CareEpisodeDetailPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string; patientId: string; episodeId: string }>;
}) {
  const { dispensarySlug, episodeId } = await params;
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForDispensary(
    session as AuthSession | null,
    dispensary.id,
  );

  const episodeResult = await getCareEpisode(dispensarySlug, episodeId);
  if (episodeResult.status === 404) notFound();
  if (episodeResult.status !== 200 || !('data' in episodeResult) || !episodeResult.data) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const consultationsResult = await listConsultations(dispensarySlug, episodeId);

  const userId = session?.user?.id;
  const canEditSchema =
    userId && episodeResult.data
      ? await canEditCabinetFormSchema(
          dispensary.id,
          episodeResult.data.patient.cabinetId,
          userId,
          session?.user?.role,
          effectiveRole,
        )
      : false;

  return (
    <CareEpisodeDetailPageClient
      dispensarySlug={dispensarySlug}
      episode={episodeResult.data}
      initialConsultations={
        consultationsResult.status === 200 && 'data' in consultationsResult
          ? consultationsResult.data ?? []
          : []
      }
      canEditSchema={canEditSchema}
    />
  );
}
