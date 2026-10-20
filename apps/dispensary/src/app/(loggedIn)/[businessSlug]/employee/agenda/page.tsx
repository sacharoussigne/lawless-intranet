import { AgendaPageContent } from './AgendaPageContent';

export default async function AgendaPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessSlug: string }>;
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const { businessSlug } = await params;
  const { view } = await searchParams;
  return (
    <AgendaPageContent
      businessSlug={businessSlug}
      mobileView="calendar"
      view={typeof view === 'string' ? view : undefined}
    />
  );
}
