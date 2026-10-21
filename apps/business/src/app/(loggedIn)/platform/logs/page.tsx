export const dynamic = 'force-dynamic';

import { listAppLogs } from '@/app/_actions/appLogs';
import { listBusinessesForPlatform } from '@/app/_actions/businesses';
import { DEFAULT_LOG_PERIOD, logPeriodStart } from './logPeriods';
import { LogsPageClient } from './LogsPageClient';

export default async function PlatformLogsPage() {
  const [logsResult, businessesResult] = await Promise.all([
    listAppLogs({ page: 1, from: logPeriodStart(DEFAULT_LOG_PERIOD) }),
    listBusinessesForPlatform(),
  ]);
  const businesses =
    businessesResult.status === 200 && 'data' in businessesResult
      ? (businessesResult.data ?? []).map((business) => ({
          id: business.id,
          name: business.settings?.businessName?.trim() || business.name,
        }))
      : [];
  return (
    <LogsPageClient
      initialLogs={logsResult.status === 200 && 'data' in logsResult ? logsResult.data ?? null : null}
      businesses={businesses}
    />
  );
}
