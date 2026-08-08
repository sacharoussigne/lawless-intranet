import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function DispensaryMembersPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  redirect(`${tenantRoutes(dispensarySlug).admin.settings}?tab=members`);
}
