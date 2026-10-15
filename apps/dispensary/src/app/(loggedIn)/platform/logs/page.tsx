export const dynamic = 'force-dynamic';

import { listAppLogs } from '@/app/_actions/appLogs';
import { listDispensariesForPlatform } from '@/app/_actions/dispensaries';
import { DEFAULT_LOG_PERIOD, logPeriodStart } from './logPeriods';
import { LogsPageClient } from './LogsPageClient';

export default async function PlatformLogsPage() {
  const [logsResult, dispensariesResult] = await Promise.all([
    listAppLogs({ page: 1, from: logPeriodStart(DEFAULT_LOG_PERIOD) }),
    listDispensariesForPlatform(),
  ]);
  const dispensaries =
    dispensariesResult.status === 200 && 'data' in dispensariesResult
      ? (dispensariesResult.data ?? []).map((dispensary) => ({
          id: dispensary.id,
          name: dispensary.settings?.dispensaryName?.trim() || dispensary.name,
        }))
      : [];
  return (
    <LogsPageClient
      initialLogs={logsResult.status === 200 && 'data' in logsResult ? logsResult.data ?? null : null}
      dispensaries={dispensaries}
    />
  );
}
