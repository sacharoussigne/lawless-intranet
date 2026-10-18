import { getAuthSession } from '@/lib/authSession';
import { routes } from '@/types/routes';
import { listAccessibleBusinesses } from '@/lib/business/context';
import { redirect } from 'next/navigation';
import { tenantRoutes } from '@/types/routes';

export default async function Home() {
  const session = await getAuthSession();
  if (!session) {
    redirect(routes.auth.login);
  }

  const accessible = await listAccessibleBusinesses(session);
  if (accessible.length === 0) {
    redirect(routes.auth.noBusinessAccess);
  }
  redirect(tenantRoutes(accessible[0].slug).employee.index);
}
