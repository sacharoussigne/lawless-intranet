'use client';

import { useEffect, useEffectEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { notifications } from '@mantine/notifications';

/**
 * Opens the edit window of the entity asked by the URL (`?edit=<id>`, from the command palette),
 * then drops the parameter (the tab stays). `tabs`: the `?tab=` values this panel answers to (`null`
 * = no tab, the default one), so two panels of a page never both answer. `onEdit` returns false
 * when the entity is not in the list (deleted since): a notification says so.
 */
export function useEditParam(onEdit: (id: string) => boolean, tabs: (string | null)[] | 'any' = 'any'): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const editId = searchParams.get('edit');
  const tab = searchParams.get('tab');
  const mine = Boolean(editId) && (tabs === 'any' || tabs.includes(tab));
  const run = useEffectEvent((id: string) => {
    if (!onEdit(id)) {
      notifications.show({ title: 'Introuvable', message: 'Cet élément n’existe plus.', color: 'danger' });
    }
  });

  useEffect(() => {
    if (!mine || !editId) return;
    run(editId);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [mine, editId, pathname, router, searchParams]);
}
