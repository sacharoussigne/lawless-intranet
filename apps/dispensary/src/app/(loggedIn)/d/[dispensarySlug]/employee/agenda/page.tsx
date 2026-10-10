import { AgendaPageContent } from './AgendaPageContent';

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ dispensarySlug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { dispensarySlug } = await params;
  const { view } = await searchParams;
  return (
    <AgendaPageContent
      dispensarySlug={dispensarySlug}
      mobileView="calendar"
      view={typeof view === 'string' ? view : undefined}
    />
  );
}
