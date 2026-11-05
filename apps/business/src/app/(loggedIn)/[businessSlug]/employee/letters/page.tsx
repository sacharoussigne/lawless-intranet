import { redirect } from 'next/navigation';
import { Container } from '@mantine/core';
import { getLettersPageBootstrap } from '@/app/_actions/letters/letters';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { tenantRoutes } from '@/types/routes';
import { LettersPageClient } from './LettersPageClient';

async function LettersContent({
  businessSlug,
  boxId,
  correspondentId,
}: {
  businessSlug: string;
  boxId: string | null;
  correspondentId: string | null;
}) {
  const data = getDataOrThrow(
    await getLettersPageBootstrap(businessSlug, { boxId, correspondentId }),
    'Erreur lors du chargement des lettres',
  );
  const box = data.boxes.find((entry) => entry.id === data.boxId);
  // Not a member of any box: nothing to show (the link is hidden too).
  if (!box) redirect(tenantRoutes(businessSlug).employee.index);
  return <LettersPageClient key={box.id} initial={data} box={box} />;
}

function param(value: string | string[] | undefined): string | null {
  return typeof value === 'string' && value ? value : null;
}

export default async function LettersPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ box?: string | string[]; c?: string | string[] }>;
}) {
  const { businessSlug } = await params;
  const query = await searchParams;

  return (
    <Container size="xl" py={{ base: 'xs', sm: 'lg' }}>
      <SuspenseLoader>
        <LettersContent businessSlug={businessSlug} boxId={param(query.box)} correspondentId={param(query.c)} />
      </SuspenseLoader>
    </Container>
  );
}
