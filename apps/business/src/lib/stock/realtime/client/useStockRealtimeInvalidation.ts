'use client';

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { REALTIME_DOMAIN } from '@lawless-intranet/realtime';
import { useRealtimeSocketEvents, useRealtimeSocketResync } from '@lawless-intranet/realtime/socket';
import { categoryItemsKeys } from '@/lib/categoryItems/queryKeys';
import { chestsKeys } from '@/lib/chests/queryKeys';
import { itemsKeys } from '@/lib/items/queryKeys';
import { stockKeys } from '@/lib/stock/queryKeys';

const DOMAINS = [REALTIME_DOMAIN.stock] as const;

/**
 * Every query showing stock data in the dispensary: quantities per chest,
 * movements, statistics, crafts and recipes, items, chests and categories,
 * and the stock lists of the sale and order modals.
 */
function stockQueryRoots(slug: string): readonly (readonly unknown[])[] {
  return [
    stockKeys.all(slug),
    ['craft', slug],
    itemsKeys.all(slug),
    chestsKeys.all(slug),
    categoryItemsKeys.all(slug),
    ['overwrite-stock', slug],
    ['sellable-items', slug],
    ['chests-list', slug],
  ];
}

/**
 * Refetches the stock data on screen when someone else changes stock in the
 * dispensary (messages are hints: no data is patched from them), and after a
 * reconnection. Bursts (a whole craft queue) are coalesced.
 */
export function useStockRealtimeInvalidation(slug: string, enabled: boolean) {
  const queryClient = useQueryClient();

  const invalidate = useCallback(() => {
    for (const queryKey of stockQueryRoots(slug)) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient, slug]);

  useRealtimeSocketEvents({ enabled, domains: DOMAINS, coalesceMs: 300, onEvent: invalidate });
  useRealtimeSocketResync(invalidate, enabled);
}
