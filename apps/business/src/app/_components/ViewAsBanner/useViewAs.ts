'use client';

import { useState } from 'react';
import { notifications } from '@mantine/notifications';
import { setViewAs, stopViewAs } from '@/app/_actions/viewAs';
import { tenantRoutes } from '@/types/routes';

/**
 * Starts, changes or leaves the « Voir en tant que » view, then reloads the
 * whole page: React Query caches and the realtime token hold the old rights.
 */
export function useViewAs(businessSlug: string) {
  const [pending, setPending] = useState(false);

  const run = async (call: () => Promise<{ status: number; error?: unknown }>, after: () => void) => {
    setPending(true);
    try {
      const result = await call();
      if (result.status !== 200) {
        const message = typeof result.error === 'string' ? result.error : 'Erreur';
        notifications.show({ title: 'Erreur', message, color: 'danger' });
        return;
      }
      after();
    } finally {
      setPending(false);
    }
  };

  return {
    pending,
    /** First role picked from the settings: opens the employee home as that role. */
    start: (roles: string[]) =>
      run(
        () => setViewAs(businessSlug, roles),
        () => window.location.assign(tenantRoutes(businessSlug).employee.index),
      ),
    change: (roles: string[]) => run(() => setViewAs(businessSlug, roles), () => window.location.reload()),
    stop: () =>
      run(
        () => stopViewAs(),
        () => window.location.assign(`${tenantRoutes(businessSlug).admin.settings}?tab=permissions`),
      ),
  };
}
