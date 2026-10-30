'use client';

import { useMemo } from 'react';
import { BankPage, BankUiProvider } from '@lawless-intranet/bank-ui';
import type { SerializedBankWeek } from '@lawless-intranet/bank-ui';
import { createBusinessBankActions } from '@/lib/bank/bankUiActions';
import { useRpCalendar } from '@/app/_contexts/RpCalendarContext';

type BusinessBankWorkspaceProps = {
  businessSlug: string;
  initialWeek: SerializedBankWeek;
};

export function BusinessBankWorkspace({
  businessSlug,
  initialWeek,
}: BusinessBankWorkspaceProps) {
  const actions = useMemo(
    () => createBusinessBankActions(businessSlug),
    [businessSlug],
  );
  const { offset } = useRpCalendar();

  return (
    <BankUiProvider scopeKey={businessSlug} actions={actions} rpYearOffset={offset}>
      <BankPage initialWeek={initialWeek} />
    </BankUiProvider>
  );
}
