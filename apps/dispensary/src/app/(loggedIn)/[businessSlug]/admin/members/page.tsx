import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function BusinessMembersPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  redirect(`${tenantRoutes(businessSlug).admin.settings}?tab=members`);
}
