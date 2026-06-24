import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function CategoryItemsPage({
  params,
}: {
  params: Promise<{ dispensarySlug: string }>;
}) {
  const { dispensarySlug } = await params;
  const t = tenantRoutes(dispensarySlug);
  redirect(t.management.items('categories'));
}
