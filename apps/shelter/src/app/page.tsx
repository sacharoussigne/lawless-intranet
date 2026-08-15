import { getAuthSession } from '@/lib/authSession';
import { routes, tenantRoutes } from '@/types/routes';
import { listAccessibleShelters } from '@/lib/shelter/context';
import { isPlatformAdmin } from '@/lib/shelter/platformAdmin';
import { redirect } from 'next/navigation';

export default async function Home() {
  const session = await getAuthSession();
  if (!session) {
    redirect(routes.auth.login);
  }

  const accessible = await listAccessibleShelters(session);
  if (accessible.length === 0) {
    if (isPlatformAdmin(session.user.role)) {
      redirect(routes.platform.shelters);
    }
    redirect(routes.auth.noShelterAccess);
  }
  redirect(tenantRoutes(accessible[0].slug).employee.index);
}
