import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function LegacySpeciesRedirect({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  redirect(tenantRoutes(shelterSlug).management.species);
}
