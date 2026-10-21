export const dynamic = 'force-dynamic';

import { listBusinessesForPlatform } from '@/app/_actions/businesses';
import { BusinessesPlatformClient } from './BusinessesPlatformClient';

export default async function PlatformBusinessesPage() {
  const result = await listBusinessesForPlatform();
  return (
    <BusinessesPlatformClient
      initialBusinesses={result.status === 200 ? result.data ?? [] : []}
      error={result.status !== 200 ? result.error : undefined}
    />
  );
}
