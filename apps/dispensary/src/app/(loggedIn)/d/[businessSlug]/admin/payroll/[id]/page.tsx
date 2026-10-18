import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

type PageProps = { params: Promise<{ businessSlug: string; id: string }> };

export default async function PayrollReportByIdPage({ params }: PageProps) {
  const { businessSlug, id } = await params;
  redirect(tenantRoutes(businessSlug).employee.payrollDetail(id));
}
