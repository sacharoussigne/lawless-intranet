import { getUserMailTemplateOptions } from '@/app/_actions/mailTemplates';
import NewMailPageClient from './NewMailPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function NewMailContent({ businessSlug }: { businessSlug: string }) {
  const optionsResult = await getUserMailTemplateOptions(businessSlug);
  const templateOptions = getDataOrThrow(
    optionsResult,
    'Erreur lors du chargement des templates',
  );

  return <NewMailPageClient initialTemplateOptions={templateOptions} />;
}

export default async function NewMailPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <NewMailContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
