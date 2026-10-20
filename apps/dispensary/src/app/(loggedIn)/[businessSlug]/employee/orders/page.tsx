import { getOrdersPage } from '@/app/_actions/orders';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import OrdersPageClient from './OrdersPageClient';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getDataOrThrow } from '@/lib/response';
import { defaultOrdersPageFilters } from '@/lib/orders/queryKeys';

async function OrdersContent({ businessSlug }: { businessSlug: string }) {
  const [ordersResult, assignmentsResult] = await Promise.all([
    getOrdersPage(businessSlug, {
      page: defaultOrdersPageFilters.page,
      pageSize: defaultOrdersPageFilters.pageSize,
    }),
    getOrderLetterTemplateAssignments(businessSlug),
  ]);

  const initialOrdersPage = getDataOrThrow(
    ordersResult,
    'Erreur lors du chargement des commandes',
  );
  const initialAssignments = getDataOrThrow(
    assignmentsResult,
    'Erreur lors du chargement des assignations de modèles de courriers',
  );

  return (
    <OrdersPageClient
      initialOrdersPage={initialOrdersPage}
      initialAssignments={initialAssignments}
    />
  );
}

export default async function OrdersPage({
  params,
}: {
  params: Promise<{ businessSlug: string }>;
}) {
  const { businessSlug } = await params;
  return (
    <SuspenseLoader>
      <OrdersContent businessSlug={businessSlug} />
    </SuspenseLoader>
  );
}
