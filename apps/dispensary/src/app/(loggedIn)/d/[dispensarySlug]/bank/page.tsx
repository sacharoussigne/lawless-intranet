import { getOrCreateWeek } from '@/app/_actions/bankAccounts';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { DispensaryBankWorkspace } from './DispensaryBankWorkspace';

async function BankContent({ dispensarySlug }: { dispensarySlug: string }) {
  const weekResult = await getOrCreateWeek(dispensarySlug, new Date());
  const initialWeek = getDataOrThrow(weekResult, 'Erreur lors du chargement de la semaine bancaire');

  return (
    <DispensaryBankWorkspace
      dispensarySlug={dispensarySlug}
      initialWeek={initialWeek}
    />
  );
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
