import { notFound } from 'next/navigation';
import { getOrderById } from '@/app/_actions/orders';
import { getOrderChatter } from '@/app/_actions/orderChatter';
import { getOrderLetterTemplateAssignments } from '@/app/_actions/orderLetterTemplateAssignments';
import { SuspenseLoader } from '@/app/_components/SuspenseLoader/SuspenseLoader';
import { getAuthSession } from '@/lib/authSession';
import { getDataOrThrow } from '@/lib/response';
import { OrderDetailPageClient } from './OrderDetailPageClient';

async function OrderDetailContent({
  businessSlug,
  orderId,
}: {
  businessSlug: string;
  orderId: string;
}) {
  const [session, orderResult, chatterResult, assignmentsResult] = await Promise.all([
    getAuthSession(),
    getOrderById(businessSlug, { id: orderId }),
    getOrderChatter(businessSlug, { orderId }),
    getOrderLetterTemplateAssignments(businessSlug),
  ]);
  // Unknown id, or an id that is not a uuid (422).
  if (orderResult.status === 404 || orderResult.status === 422) notFound();

  const order = getDataOrThrow(orderResult, 'Erreur lors du chargement de la commande');
  const chatter = getDataOrThrow(chatterResult, 'Erreur lors du chargement du fil de la commande');
  const assignments = getDataOrThrow(
    assignmentsResult,
    'Erreur lors du chargement des assignations de modèles de courriers',
  );

  return (
    <OrderDetailPageClient
      orderId={orderId}
      currentUserId={session?.user?.id ?? ''}
      initialOrder={order}
      initialChatter={chatter}
      initialAssignments={assignments}
    />
  );
}

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ businessSlug: string; orderId: string }>;
}) {
  const { businessSlug, orderId } = await params;
  return (
    <SuspenseLoader>
      <OrderDetailContent businessSlug={businessSlug} orderId={orderId} />
    </SuspenseLoader>
  );
}
