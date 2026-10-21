import { getOrCreateWeek } from '@/app/_actions/bankAccounts';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { BusinessBankWorkspace } from './BusinessBankWorkspace';

async function BankContent({ businessSlug }: { businessSlug: string }) {
  const weekResult = await getOrCreateWeek(businessSlug, new Date());
  const initialWeek = getDataOrThrow(weekResult, 'Erreur lors du chargement de la semaine bancaire');

  return (
    <BusinessBankWorkspace
      businessSlug={businessSlug}
      initialWeek={initialWeek}
    />
  );
}

export default async function BankPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <BankContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
