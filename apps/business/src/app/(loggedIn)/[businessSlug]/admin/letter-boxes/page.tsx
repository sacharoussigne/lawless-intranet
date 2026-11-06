import { listLetterBoxesForAdmin } from '@/app/_actions/letters/boxes';
import { getDataOrThrow } from '@/lib/response';
import { LetterBoxesAdminPageClient } from './LetterBoxesAdminPageClient';

export default async function LetterBoxesAdminPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  const boxes = getDataOrThrow(
    await listLetterBoxesForAdmin(businessSlug),
    'Erreur lors du chargement des boîtes aux lettres',
  );
  return <LetterBoxesAdminPageClient initialBoxes={boxes} />;
}
