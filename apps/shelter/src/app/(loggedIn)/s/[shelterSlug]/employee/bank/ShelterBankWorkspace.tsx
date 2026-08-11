'use client';

import { useMemo } from 'react';
import { BankPage, BankUiProvider } from '@lawless-intranet/bank-ui';
import type { SerializedBankWeek } from '@lawless-intranet/bank-ui';
import { createShelterBankActions } from '@/lib/bank/bankUiActions';

type ShelterBankWorkspaceProps = {
  shelterSlug: string;
  initialWeek: SerializedBankWeek;
};

export function ShelterBankWorkspace({
  shelterSlug,
  initialWeek,
}: ShelterBankWorkspaceProps) {
  const actions = useMemo(() => createShelterBankActions(shelterSlug), [shelterSlug]);

  return (
    <BankUiProvider scopeKey={shelterSlug} actions={actions}>
      <BankPage initialWeek={initialWeek} />
    </BankUiProvider>
  );
}
