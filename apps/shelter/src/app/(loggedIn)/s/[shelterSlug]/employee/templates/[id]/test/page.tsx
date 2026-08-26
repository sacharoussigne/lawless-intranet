import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function LegacyTemplateTestRedirect({
  params,
}: {
  params: Promise<{ shelterSlug: string; id: string }>;
}) {
  const { shelterSlug, id } = await params;
  redirect(tenantRoutes(shelterSlug).management.templateTest(id));
}
