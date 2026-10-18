import type { Metadata } from 'next';
import { AgendaPageContent } from '../AgendaPageContent';

export const metadata: Metadata = { title: 'Tâches' };

/** Tasks tab of the phone app: the agenda workspace showing the to-do lists only on phones. */
export default async function AgendaTasksPage({ params }: { params: Promise<{ businessSlug: string }> }) {
  const { businessSlug } = await params;
  return <AgendaPageContent businessSlug={businessSlug} mobileView="tasks" view={undefined} />;
}
