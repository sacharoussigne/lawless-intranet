import { listBusinessPeople } from '@/app/_actions/businessPeople';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import PeoplePageClient from './PeoplePageClient';

async function PeopleContent({ businessSlug }: { businessSlug: string }) {
  const people = getDataOrThrow(
    await listBusinessPeople(businessSlug),
    'Erreur lors du chargement des personnes',
  );
  return <PeoplePageClient initialData={people} />;
}

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;

  return (
    <SuspenseLoader>
      <PeopleContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
