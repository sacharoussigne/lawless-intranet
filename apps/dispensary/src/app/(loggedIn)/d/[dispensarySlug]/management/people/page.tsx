import { listDispensaryPeople } from '@/app/_actions/dispensaryPeople';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import PeoplePageClient from './PeoplePageClient';

async function PeopleContent({ dispensarySlug }: { dispensarySlug: string }) {
  const people = getDataOrThrow(
    await listDispensaryPeople(dispensarySlug),
    'Erreur lors du chargement des personnes',
  );
  return <PeoplePageClient initialData={people} />;
}

export default async function PeoplePage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;

  return (
    <SuspenseLoader>
      <PeopleContent dispensarySlug={dispensarySlug} />
    </SuspenseLoader>
  );
}
