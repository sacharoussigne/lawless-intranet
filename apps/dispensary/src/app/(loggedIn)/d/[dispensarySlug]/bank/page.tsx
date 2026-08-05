import { getOrCreateWeek, getBankGlobalStats } from '@/app/_actions/bankAccounts';
import BankPageClient from './BankPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';

async function BankContent({ dispensarySlug }: { dispensarySlug: string }) {
  const [weekResult, statsResult] = await Promise.all([
    getOrCreateWeek(dispensarySlug, new Date()),
    getBankGlobalStats(dispensarySlug),
  ]);

  const initialWeek = getDataOrThrow(weekResult, 'Erreur lors du chargement de la semaine bancaire');
  const initialStats = getDataOrThrow(statsResult, 'Erreur lors du chargement des statistiques');

  return <BankPageClient initialWeek={initialWeek} initialStats={initialStats} />;
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
