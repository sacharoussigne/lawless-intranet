'use client';

import type { ReactElement } from 'react';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';

/** « Dupliquer » asks first: a misclick no longer creates a copy of the order. */
export function DuplicateConfirm({
  onConfirm,
  children,
}: {
  onConfirm: () => void | Promise<void>;
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
}) {
  return (
    <DeleteConfirmPopover
      title="Dupliquer la commande ?"
      message="Une copie de la commande (articles compris) sera créée en brouillon."
      confirmLabel="Dupliquer"
      confirmColor="sage"
      onConfirm={onConfirm}
    >
      {children}
    </DeleteConfirmPopover>
  );
}
