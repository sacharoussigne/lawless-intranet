import { getOrCreateWeek } from '@/app/_actions/bankAccounts';
import BankPageClient from './BankPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function BankContent({ dispensarySlug }: { dispensarySlug: string }) {
  const weekResult = await getOrCreateWeek(dispensarySlug, new Date());
  const initialWeek = getDataOrThrow(weekResult, 'Erreur lors du chargement de la semaine bancaire');

  return <BankPageClient initialWeek={initialWeek} />;
}

export default async function BankPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  return (
    <SuspenseLoader>
      <BankContent dispensarySlug={dispensarySlug} />
    </SuspenseLoader>
  );
}
