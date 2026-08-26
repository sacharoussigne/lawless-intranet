import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function LegacyTemplateNewRedirect({
  params,
}: {
  params: Promise<{ shelterSlug: string }>;
}) {
  const { shelterSlug } = await params;
  redirect(tenantRoutes(shelterSlug).management.templateNew);
}
