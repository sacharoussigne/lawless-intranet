'use client';

import { useMemo } from 'react';
import { BankPage, BankUiProvider } from '@lawless-intranet/bank-ui';
import type { SerializedBankWeek } from '@lawless-intranet/bank-ui';
import { createDispensaryBankActions } from '@/lib/bank/bankUiActions';

type DispensaryBankWorkspaceProps = {
  dispensarySlug: string;
  initialWeek: SerializedBankWeek;
};

export function DispensaryBankWorkspace({
  dispensarySlug,
  initialWeek,
}: DispensaryBankWorkspaceProps) {
  const actions = useMemo(
    () => createDispensaryBankActions(dispensarySlug),
    [dispensarySlug],
  );

  return (
    <BankUiProvider scopeKey={dispensarySlug} actions={actions}>
      <BankPage initialWeek={initialWeek} />
    </BankUiProvider>
  );
}
