'use client';

import { useMemo } from 'react';
import { BankPage, BankUiProvider } from '@lawless-intranet/bank-ui';
import type { SerializedBankWeek } from '@lawless-intranet/bank-ui';
import { createBusinessBankActions } from '@/lib/bank/bankUiActions';

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

  return (
    <BankUiProvider scopeKey={businessSlug} actions={actions}>
      <BankPage initialWeek={initialWeek} />
    </BankUiProvider>
  );
}
