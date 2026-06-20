'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AuthSession } from '@lawless-intranet/types';
import { authClient } from './browser';

type UseSessionResult = {
  session: AuthSession | null;
  isPending: boolean;
  refresh: () => Promise<void>;
};

export function useSession(): UseSessionResult {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isPending, setIsPending] = useState(true);

  const refresh = useCallback(async () => {
    setIsPending(true);
    const result = await authClient.getSession();
    if (result.data) {
      setSession({
        session: {
          id: result.data.session.id,
          expiresAt: result.data.session.expiresAt.toISOString(),
          impersonatedBy: result.data.session.impersonatedBy ?? null,
        },
        user: {
          id: result.data.user.id,
          name: result.data.user.name,
          email: result.data.user.email,
          image: result.data.user.image ?? null,
          role: result.data.user.role ?? null,
          discordId: null,
        },
      });
    } else {
      setSession(null);
    }
    setIsPending(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, isPending, refresh };
}
