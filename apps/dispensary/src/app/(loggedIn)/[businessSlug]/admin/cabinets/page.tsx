import { listCabinetsForAdmin } from '@/app/_actions/cabinet/cabinets';
import { CabinetsAdminPageClient } from './CabinetsAdminPageClient';

export default async function CabinetsAdminPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const result = await listCabinetsForAdmin(businessSlug);

  return (
    <CabinetsAdminPageClient
      businessSlug={businessSlug}
      initialCabinets={result.status === 200 && 'data' in result ? result.data ?? [] : []}
      error={result.status !== 200 && 'error' in result ? String(result.error) : undefined}
    />
  );
}
