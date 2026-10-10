import type { Metadata } from 'next';
import { AgendaPageContent } from '../AgendaPageContent';

export const metadata: Metadata = { title: 'Tâches' };

/** Tasks tab of the phone app: the agenda workspace showing the to-do lists only on phones. */
export default async function AgendaTasksPage({ params }: { params: Promise<{ dispensarySlug: string }> }) {
  const { dispensarySlug } = await params;
  return <AgendaPageContent dispensarySlug={dispensarySlug} mobileView="tasks" view={undefined} />;
}
