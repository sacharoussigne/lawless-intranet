import { redirect } from 'next/navigation';
import { Container } from '@mantine/core';
import { getMediaContents, getMediaLibraryLimits } from '@/app/_actions/media';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { tenantRoutes } from '@/types/routes';
import { ShelterMediaWorkspace } from './ShelterMediaWorkspace';

async function MediaContent({ shelterSlug, folderId }: { shelterSlug: string; folderId: string | null }) {
  const [limitsResult, contentsResult] = await Promise.all([
    getMediaLibraryLimits(shelterSlug),
    getMediaContents(shelterSlug, folderId),
  ]);

  // Unknown or deleted folder in the URL: back to the library root.
  if (folderId && (contentsResult.status === 404 || contentsResult.status === 422)) {
    redirect(tenantRoutes(shelterSlug).employee.media);
  }

  const limits = getDataOrThrow(limitsResult, 'Erreur lors du chargement de la médiathèque');
  const contents = getDataOrThrow(contentsResult, 'Erreur lors du chargement du dossier');

  return (
    <ShelterMediaWorkspace
      shelterSlug={shelterSlug}
      limits={limits}
      initialFolderId={folderId}
      initialContents={contents}
    />
  );
}

export default async function MediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ shelterSlug: string }>;
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const { shelterSlug } = await params;
  const { folder } = await searchParams;
  const folderId = typeof folder === 'string' && folder ? folder : null;

  return (
    <Container size="xl">
      <PageHeader title="Médiathèque" description="Images et documents du refuge, rangés par dossiers." />
      <SuspenseLoader>
        <MediaContent shelterSlug={shelterSlug} folderId={folderId} />
      </SuspenseLoader>
    </Container>
  );
}
