import { getAuthSession } from '@/lib/authSession';
import { routes, tenantRoutes } from '@/types/routes';
import { redirect } from 'next/navigation';
import {
  currentBusinessHost,
  listAccessibleBusinessesForRequest,
} from '@/lib/business/accessibleBusinesses';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import { BusinessPicker } from '@/app/_components/BusinessPicker/BusinessPicker';

/**
 * Root of the app: straight into the only business the user can open here,
 * a picker when there are several, a welcome page when there is none. A host of
 * a kind of business (BUSINESS_TYPE_HOSTS) only offers the businesses of that kind.
 */
export default async function Home() {
  const session = await getAuthSession();
  if (!session) {
    redirect(routes.auth.login);
  }

  const [all, host] = await Promise.all([
    listAccessibleBusinessesForRequest(session),
    currentBusinessHost(),
  ]);
  const businesses = host.type ? all.filter((b) => b.type === host.type) : all;

  if (businesses.length === 1) {
    const [only] = businesses;
    redirect(`${only.origin}${tenantRoutes(only.slug).employee.index}`);
  }

  return (
    <BusinessPicker
      businesses={businesses}
      hostType={host.type}
      isPlatformAdmin={isPlatformAdmin(session.user.role)}
    />
  );
}
