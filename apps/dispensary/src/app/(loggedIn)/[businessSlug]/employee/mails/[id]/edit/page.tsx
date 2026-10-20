import { getMailById } from '@/app/_actions/mails';
import EditMailPageClient from './EditMailPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

async function EditMailContent({
  businessSlug,
  mailId,
}: {
  businessSlug: string;
  mailId: string;
}) {
  const mailResult = await getMailById(businessSlug, { id: mailId });

  if (mailResult.status === 404) {
    redirect(tenantRoutes(businessSlug).employee.mails);
  }

  const mail = getDataOrThrow(mailResult, 'Erreur lors du chargement du courrier');

  return <EditMailPageClient mail={mail} />;
}

export default async function EditMailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; id: string }>;
}) {
  const { businessSlug, id } = await params;

  return (
    <SuspenseLoader>
      <EditMailContent businessSlug={businessSlug} mailId={id} />
    </SuspenseLoader>
  );
}
