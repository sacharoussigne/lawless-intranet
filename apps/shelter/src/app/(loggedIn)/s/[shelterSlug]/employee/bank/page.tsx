import { getOrCreateWeek } from '@/app/_actions/bankAccounts';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { ShelterBankWorkspace } from './ShelterBankWorkspace';

async function BankContent({ shelterSlug }: { shelterSlug: string }) {
  const weekResult = await getOrCreateWeek(shelterSlug, new Date());
  const initialWeek = getDataOrThrow(weekResult, 'Erreur lors du chargement de la semaine bancaire');

  return <ShelterBankWorkspace shelterSlug={shelterSlug} initialWeek={initialWeek} />;
}

export default async function BankPage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <BankContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
