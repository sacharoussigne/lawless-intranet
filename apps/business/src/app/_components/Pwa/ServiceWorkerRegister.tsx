'use client';

import { useEffect } from 'react';

/** Registers /sw.js (offline page only, no data cache). Production only: no stale assets while developing. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => undefined);
  }, []);

  return null;
}
