'use client';

import { useMemo } from 'react';
import { BankPage, BankUiProvider } from '@lawless-intranet/bank-ui';
import type { SerializedBankWeek } from '@lawless-intranet/bank-ui';
import { createShelterBankActions } from '@/lib/bank/bankUiActions';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';

type ShelterBankWorkspaceProps = {
  shelterSlug: string;
  initialWeek: SerializedBankWeek;
};

export function ShelterBankWorkspace({
  shelterSlug,
  initialWeek,
}: ShelterBankWorkspaceProps) {
  const actions = useMemo(() => createShelterBankActions(shelterSlug), [shelterSlug]);
  const { offset } = useRpCalendar();

  return (
    <BankUiProvider scopeKey={shelterSlug} actions={actions} rpYearOffset={offset}>
      <BankPage initialWeek={initialWeek} />
    </BankUiProvider>
  );
}
