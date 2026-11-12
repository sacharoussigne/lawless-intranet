'use client';

import { useEffect, useEffectEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

/**
 * Opens something of the page when the URL asks for it (`?action=<name>`, from the command palette),
 * then drops the parameter so a refresh does not open it again.
 */
export function useActionParam(name: string, onAction: () => void, enabled = true): void {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const requested = enabled && searchParams.get('action') === name;
  const run = useEffectEvent(onAction);

  useEffect(() => {
    if (!requested) return;
    run();
    const params = new URLSearchParams(searchParams.toString());
    params.delete('action');
    const rest = params.toString();
    router.replace(rest ? `${pathname}?${rest}` : pathname, { scroll: false });
  }, [requested, pathname, router, searchParams]);
}
