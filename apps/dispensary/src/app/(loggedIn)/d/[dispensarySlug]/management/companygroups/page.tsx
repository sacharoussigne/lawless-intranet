import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function CompanyGroupsPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const t = tenantRoutes(dispensarySlug);
  redirect(t.management.companies('groups'));
}
