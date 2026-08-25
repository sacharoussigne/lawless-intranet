import { redirect } from 'next/navigation';
import {
  listAnimalWaitRequests,
  listWaitlistSpeciesOptions,
} from '@/app/_actions/animalWaitRequests';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { requireTenantServerActionContext } from '@/lib/serverActionAuth';
import { waitlistManageAuth } from '@/lib/animals/waitlistAuth';
import { tenantRoutes } from '@/types/routes';
import { WaitlistPageClient } from './WaitlistPageClient';

async function WaitlistContent({ shelterSlug }: { shelterSlug: string }) {
  const auth = await requireTenantServerActionContext(shelterSlug, waitlistManageAuth);
  if (!auth.ok) {
    redirect(tenantRoutes(shelterSlug).employee.index);
  }

  const [requestsResult, speciesResult] = await Promise.all([
    listAnimalWaitRequests(shelterSlug),
    listWaitlistSpeciesOptions(shelterSlug),
  ]);

  if (requestsResult.status === 403 || speciesResult.status === 403) {
    redirect(tenantRoutes(shelterSlug).employee.index);
  }

  return (
    <WaitlistPageClient
      shelterSlug={shelterSlug}
      initialRequests={
        requestsResult.status === 200 && 'data' in requestsResult
          ? (requestsResult.data ?? [])
          : []
      }
      speciesOptions={
        speciesResult.status === 200 && 'data' in speciesResult
          ? (speciesResult.data ?? [])
          : []
      }
    />
  );
}

export default async function WaitlistPage({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  return (
    <SuspenseLoader>
      <WaitlistContent shelterSlug={shelterSlug} />
    </SuspenseLoader>
  );
}
