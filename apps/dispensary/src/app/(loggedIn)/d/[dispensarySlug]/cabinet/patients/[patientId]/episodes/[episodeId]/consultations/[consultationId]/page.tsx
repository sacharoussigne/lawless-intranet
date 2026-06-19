import { getConsultation } from '@/app/_actions/cabinet/consultations';
import { getAuthSession } from '@/lib/authSession';
import { getEffectiveRoleForDispensary, requireDispensaryFromSlug } from '@/lib/dispensary/context';
import { canEditCabinetFormSchema } from '@/lib/cabinet/access';
import { redirect, notFound } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';
import type { AuthSession } from '@/types/session';
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
  const dispensary = await requireDispensaryFromSlug(dispensarySlug);
  const session = await getAuthSession();
  const effectiveRole = await getEffectiveRoleForDispensary(
    session as AuthSession | null,
    dispensary.id,
  );

  const consultationResult = await getConsultation(dispensarySlug, consultationId);
  if (consultationResult.status === 404) notFound();
  if (
    consultationResult.status !== 200 ||
    !('data' in consultationResult) ||
    !consultationResult.data
  ) {
    redirect(tenantRoutes(dispensarySlug).employee.index);
  }

  const userId = session?.user?.id;
  const canEditSchema =
    userId && consultationResult.data
      ? await canEditCabinetFormSchema(
          dispensary.id,
          consultationResult.data.careEpisode.patient.cabinetId,
          userId,
          session?.user?.role,
          effectiveRole,
        )
      : false;

  return (
    <ConsultationDetailPageClient
      dispensarySlug={dispensarySlug}
      consultation={consultationResult.data}
      canEditSchema={canEditSchema}
    />
  );
}
