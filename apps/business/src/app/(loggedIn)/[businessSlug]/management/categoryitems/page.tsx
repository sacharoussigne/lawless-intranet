import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function CategoryItemsPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  const t = tenantRoutes(businessSlug);
  redirect(t.management.items('categories'));
}
