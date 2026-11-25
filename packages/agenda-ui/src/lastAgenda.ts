/*
 * Last agenda opened, per tenant: a cookie, so the server renders that agenda straight away
 * (its events and to-do lists) instead of the first one and a switch after hydration.
 */

const ONE_YEAR_S = 60 * 60 * 24 * 365;

export function lastAgendaCookieName(scopeKey: string) {
  return `agenda-last-${scopeKey.replace(/[^A-Za-z0-9_-]/g, '_')}`;
}

export function writeLastAgendaId(scopeKey: string, agendaId: string) {
  if (typeof document === 'undefined') return;
  document.cookie = `${lastAgendaCookieName(scopeKey)}=${encodeURIComponent(agendaId)}; path=/; max-age=${ONE_YEAR_S}; SameSite=Lax`;
}

/** The preferred agenda while the user still has access to it, else the first of the list. */
export function pickInitialAgendaId(
  agendas: readonly { id: string }[],
  preferredId: string | null | undefined,
): string | null {
  if (preferredId && agendas.some((agenda) => agenda.id === preferredId)) return preferredId;
  return agendas[0]?.id ?? null;
}
