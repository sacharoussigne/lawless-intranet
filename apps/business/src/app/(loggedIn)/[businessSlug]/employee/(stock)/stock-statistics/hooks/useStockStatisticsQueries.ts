'use client';

import { useQuery } from '@tanstack/react-query';
import { useRequiredBusinessSlug } from '@/app/_contexts/PermissionsContext';
import type { StockConsumptionStatsResult } from '@/app/_actions/stock/statistics';
import { handleAction } from '@/lib/action';
import { fetchRead } from '@/lib/read/fetchRead';
import { toDateRangeKey } from '@/lib/date';
import { stockKeys } from '@/lib/stock/queryKeys';
import { DEFAULT_STALE_TIME_MS } from '@/lib/react-query/QueryProvider';

async function fetchStockConsumptionStats(
  businessSlug: string,
  from: Date,
  to: Date,
): Promise<StockConsumptionStatsResult> {
  const result = await fetchRead(businessSlug, 'stockConsumptionStats', { from, to });
  return handleAction(result) as StockConsumptionStatsResult;
}

export function useStockConsumptionStats(from: Date | null, to: Date | null) {
  const businessSlug = useRequiredBusinessSlug();
  const fromKey = from ? toDateRangeKey(from) : '';
  const toKey = to ? toDateRangeKey(to) : '';

  return useQuery({
    queryKey: stockKeys.statsConsumption(businessSlug, fromKey, toKey),
    queryFn: () => {
      if (!from || !to) throw new Error('from and to are required');
      return fetchStockConsumptionStats(businessSlug, from, to);
    },
    enabled: Boolean(businessSlug && from && to),
    placeholderData: (previous) => previous,
    staleTime: DEFAULT_STALE_TIME_MS,
  });
}
