import { redirect } from 'next/navigation';
import { Container } from '@mantine/core';
import { getMediaContents, getMediaLibraryLimits } from '@/app/_actions/media';
import { PageHeader } from '@/app/_components/PageHeader/PageHeader';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { tenantRoutes } from '@/types/routes';
import { DispensaryMediaWorkspace } from './DispensaryMediaWorkspace';

async function MediaContent({ dispensarySlug, folderId }: { dispensarySlug: string; folderId: string | null }) {
  const [limitsResult, contentsResult] = await Promise.all([
    getMediaLibraryLimits(dispensarySlug),
    getMediaContents(dispensarySlug, folderId),
  ]);

  // Unknown or deleted folder in the URL: back to the library root.
  if (folderId && (contentsResult.status === 404 || contentsResult.status === 422)) {
    redirect(tenantRoutes(dispensarySlug).employee.media);
  }

  const limits = getDataOrThrow(limitsResult, 'Erreur lors du chargement de la médiathèque');
  const contents = getDataOrThrow(contentsResult, 'Erreur lors du chargement du dossier');

  return (
    <DispensaryMediaWorkspace
      dispensarySlug={dispensarySlug}
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
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ folder?: string | string[] }>;
}) {
  const { dispensarySlug } = await params;
  const { folder } = await searchParams;
  const folderId = typeof folder === 'string' && folder ? folder : null;

  return (
    <Container size="xl" py="xl">
      <PageHeader title="Médiathèque" description="Images et documents du dispensaire, rangés par dossiers." />
      <SuspenseLoader>
        <MediaContent dispensarySlug={dispensarySlug} folderId={folderId} />
      </SuspenseLoader>
    </Container>
  );
}
