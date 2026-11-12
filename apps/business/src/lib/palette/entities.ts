import type { ItemRecord } from '@lawless-intranet/types';
import { listTemplates } from '@lawless-intranet/documents-client/server';
import {
  listCategories,
  listChests,
  listCompanies,
  listCompanyGroups,
  listItems,
  listOrdersPage,
} from '@lawless-intranet/inventory-client/server';
import prisma from '@/lib/prisma';
import { getAppSettings } from '@/lib/appSettings';
import type { TenantActionContext } from '@/lib/business/serverActionContext';
import { findBusinessProfiles } from '@/lib/businessDiscordProfile/queries';
import { getServerCookieHeader, ORDER_TEMPLATE_TYPE } from '@/lib/documents/mailDocuments';
import { pickProfileDisplayName } from '@/lib/people/displayName';
import { listAccessibleCabinetIds } from '@/lib/cabinet/access';
import { inventoryCookie, inventoryScope } from '@/lib/inventory/client';
import { listAccessibleLetterBoxIds } from '@/lib/letters/access';
import { letterTextWhere, normalizeLetterSearch } from '@/lib/letters/search';
import { createRpCalendar } from '@/lib/rpCalendar';
import { requireEffectivePermission, requireFeature } from '@/lib/serverActionAuth';
import { normalizeString } from '@/lib/string/normalizeString';
import { getOrderStatusLabel } from '@/types/enum/orderStatus';
import type { PaletteEntityHit } from '@/types/palette';
import { tenantRoutes } from '@/types/routes';

/**
 * Entity search of the command palette (« @george »). One provider per kind of entity: each checks
 * its own module and rights and returns a few hits, so a missing right only hides its section.
 * Server only (called by the guarded `searchPaletteEntities` action).
 */

export const PALETTE_ENTITY_LIMIT = 5;
/** « Gestion » mixes several kinds of entity: a few more hits. */
export const PALETTE_MANAGEMENT_LIMIT = 8;

/** Loaded once per search, shared by the providers that need it (stock items and their management). */
type SharedLoads = { items: () => Promise<ItemRecord[]> };

type Provider = (
  tenant: TenantActionContext,
  query: string,
  slug: string,
  shared: SharedLoads,
) => Promise<PaletteEntityHit[]>;

/**
 * Entries whose name holds every typed word (case and accents ignored), names starting with the
 * query first, then alphabetical.
 */
export function matchByName<T>(list: T[], query: string, getName: (entry: T) => string, limit: number): T[] {
  const needle = normalizeString(query.trim());
  const words = needle.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  return list
    .map((entry) => ({ entry, name: normalizeString(getName(entry)) }))
    .filter(({ name }) => words.every((word) => name.includes(word)))
    .sort((a, b) => Number(!a.name.startsWith(needle)) - Number(!b.name.startsWith(needle)) || a.name.localeCompare(b.name))
    .slice(0, limit)
    .map(({ entry }) => entry);
}

async function allowed(
  tenant: TenantActionContext,
  feature: Parameters<typeof requireFeature>[1],
  permission?: [resource: string, action: string],
): Promise<boolean> {
  if (!(await requireFeature(tenant.businessId, feature)).ok) return false;
  return !permission || requireEffectivePermission(tenant.effectivePermissions, ...permission).ok;
}

const searchOrders: Provider = async (tenant, query, slug) => {
  if (!(await allowed(tenant, 'orders', ['orders', 'view']))) return [];
  const page = await listOrdersPage(
    { ...inventoryScope(tenant.businessId), search: query, page: 1, pageSize: PALETTE_ENTITY_LIMIT },
    await inventoryCookie(),
  );
  const t = tenantRoutes(slug);
  return page.orders.map((order) => ({
    type: 'order',
    id: order.id,
    label: order.name,
    detail: [order.company?.name ?? order.individualCustomer?.name, getOrderStatusLabel(order.status)]
      .filter(Boolean)
      .join(' · '),
    href: t.orders.detail(order.id),
  }));
};

const searchPatients: Provider = async (tenant, query, slug) => {
  if (!(await allowed(tenant, 'cabinet'))) return [];
  // Cabinets are member-only (no role permission): only the user's cabinets.
  const cabinetIds = await listAccessibleCabinetIds(tenant.businessId, tenant.userId);
  if (cabinetIds.length === 0) return [];
  const words = query.split(/\s+/).filter(Boolean);
  const patients = await prisma.cabinetPatient.findMany({
    where: {
      cabinetId: { in: cabinetIds },
      AND: words.map((word) => ({
        OR: [
          { firstName: { contains: word, mode: 'insensitive' as const } },
          { lastName: { contains: word, mode: 'insensitive' as const } },
        ],
      })),
    },
    select: { id: true, firstName: true, lastName: true, cabinetId: true, cabinet: { select: { name: true } } },
    orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }],
    take: PALETTE_ENTITY_LIMIT,
  });
  const t = tenantRoutes(slug);
  return patients.map((patient) => ({
    type: 'patient',
    id: patient.id,
    label: `${patient.firstName} ${patient.lastName}`.trim(),
    detail: patient.cabinet.name,
    href: t.cabinet.patient(patient.cabinetId, patient.id),
  }));
};

/** Letters page on a contact, optionally scrolled to one of its letters. */
export function letterConversationHref(
  slug: string,
  link: { boxId: string; correspondentId: string; letterId?: string; archived?: boolean },
): string {
  const params = new URLSearchParams({ box: link.boxId, c: link.correspondentId });
  if (link.letterId) params.set('l', link.letterId);
  if (link.archived) params.set('archived', '1');
  return `${tenantRoutes(slug).letters.index}?${params.toString()}`;
}

const searchLetters: Provider = async (tenant, query, slug) => {
  if (!(await allowed(tenant, 'letters'))) return [];
  const boxIds = await listAccessibleLetterBoxIds(tenant.businessId, tenant.userId);
  if (boxIds.length === 0) return [];
  const [correspondents, letters, settings] = await Promise.all([
    prisma.letterCorrespondent.findMany({
      where: { boxId: { in: boxIds }, searchName: { contains: normalizeLetterSearch(query) } },
      select: { id: true, name: true, boxId: true, box: { select: { name: true } }, _count: { select: { letters: true } } },
      orderBy: { name: 'asc' },
      take: PALETTE_ENTITY_LIMIT,
    }),
    prisma.letter.findMany({
      where: { boxId: { in: boxIds }, ...letterTextWhere(query) },
      select: {
        id: true,
        title: true,
        serial: true,
        letterDate: true,
        archivedAt: true,
        boxId: true,
        correspondentId: true,
        correspondent: { select: { name: true } },
      },
      orderBy: [{ letterDate: 'desc' }, { createdAt: 'desc' }],
      take: PALETTE_ENTITY_LIMIT,
    }),
    getAppSettings(tenant.businessId),
  ]);
  const rp = createRpCalendar(settings.rpYearOffset);
  return [
    ...correspondents.map(
      (entry): PaletteEntityHit => ({
        type: 'correspondent',
        id: entry.id,
        label: entry.name,
        detail: `${entry.box.name} · ${entry._count.letters} lettre${entry._count.letters > 1 ? 's' : ''}`,
        href: letterConversationHref(slug, { boxId: entry.boxId, correspondentId: entry.id }),
      }),
    ),
    ...letters.map(
      (letter): PaletteEntityHit => ({
        type: 'letter',
        id: letter.id,
        label: letter.title,
        detail: `${letter.serial} · ${letter.correspondent.name} · ${rp.formatRpDate(letter.letterDate, 'd MMM yyyy')}`,
        href: letterConversationHref(slug, {
          boxId: letter.boxId,
          correspondentId: letter.correspondentId,
          letterId: letter.id,
          archived: letter.archivedAt !== null,
        }),
      }),
    ),
  ];
};

/** Items matching every typed word (case and accents ignored), names starting with the query first. */
export function matchPaletteItems(items: ItemRecord[], query: string, slug: string): PaletteEntityHit[] {
  const t = tenantRoutes(slug);
  return matchByName(
    items.filter((item) => item.isEnabled),
    query,
    (item) => item.name,
    PALETTE_ENTITY_LIMIT,
  ).map((item) => ({
      type: 'item',
      id: item.id,
      label: item.name,
      detail: item.category?.name ?? 'Objet',
      href: `${t.searchItems.index}?item=${encodeURIComponent(item.id)}`,
    }));
}

const searchItems: Provider = async (tenant, query, slug, shared) => {
  if (!(await allowed(tenant, 'search', ['search', 'access']))) return [];
  // No search on the inventory API: a business has a small catalog, filtered here.
  return matchPaletteItems(await shared.items(), query, slug);
};

type ManagementCandidate = {
  kind: string;
  id: string;
  name: string;
  /** Also searched, not shown (a person's Discord ID). */
  alias?: string;
  detail?: string | null;
  href: string;
};

/** Management candidates matching the query, mixed and ranked together (management/edit pages). */
export function matchManagementCandidates(candidates: ManagementCandidate[], query: string): PaletteEntityHit[] {
  return matchByName(
    candidates,
    query,
    (candidate) => [candidate.name, candidate.alias].filter(Boolean).join(' '),
    PALETTE_MANAGEMENT_LIMIT,
  ).map((candidate) => ({
    type: 'management',
    id: `${candidate.kind}:${candidate.id}`,
    label: candidate.name,
    detail: [candidate.kind, candidate.detail].filter(Boolean).join(' · '),
    href: candidate.href,
  }));
}

/**
 * « Gestion »: what the management pages edit, each hit opening its edit window (`?edit=`).
 * Same rights as the pages: management access, plus the modules and rights of people and mails.
 */
const searchManagement: Provider = async (tenant, query, slug, shared) => {
  if (!requireEffectivePermission(tenant.effectivePermissions, 'application', 'management').ok) return [];
  const m = tenantRoutes(slug).management;
  const scope = inventoryScope(tenant.businessId);
  const cookie = await inventoryCookie();
  const [peopleAllowed, mailsAllowed] = await Promise.all([
    allowed(tenant, 'weeklyActivity', ['weekly_activity', 'edit_all']),
    allowed(tenant, 'mails'),
  ]);

  const sources = await Promise.allSettled([
    shared.items().then((items) =>
      items.map((item) => ({
        kind: 'Objet',
        id: item.id,
        name: item.name,
        detail: item.isEnabled ? item.category?.name : 'désactivé',
        href: m.items(undefined, item.id),
      })),
    ),
    listCategories(scope, cookie).then((categories) =>
      categories.map((category) => ({
        kind: 'Catégorie',
        id: category.id,
        name: category.name,
        href: m.items('categories', category.id),
      })),
    ),
    listCompanies(scope, cookie).then((companies) =>
      companies.map((company) => ({
        kind: 'Entreprise',
        id: company.id,
        name: company.name,
        href: m.companies(undefined, company.id),
      })),
    ),
    listCompanyGroups(scope, cookie).then((groups) =>
      groups.map((group) => ({
        kind: 'Groupe',
        id: group.id,
        name: group.name,
        href: m.companies('groups', group.id),
      })),
    ),
    listChests(scope, cookie).then((chests) =>
      chests.map((chest) => ({ kind: 'Coffre', id: chest.id, name: chest.name, href: m.chests(chest.id) })),
    ),
    peopleAllowed
      ? findBusinessProfiles(prisma, tenant.businessId).then((people) =>
          people.map((person) => ({
            kind: 'Personne',
            id: person.discordUserId,
            name: pickProfileDisplayName(person, person.discordUserId),
            alias: person.discordUserId,
            detail: person.role,
            href: m.people(person.discordUserId),
          })),
        )
      : Promise.resolve([]),
    mailsAllowed
      ? getServerCookieHeader()
          .then((cookieHeader) =>
            listTemplates(
              { type: ORDER_TEMPLATE_TYPE, scopeId: tenant.businessId, ownerScope: 'org', pageSize: 50 },
              { cookieHeader },
            ),
          )
          .then((result) =>
            result.items.map((template) => ({
              kind: 'Modèle de courrier',
              id: template.id,
              name: template.name,
              href: m.mails(template.id),
            })),
          )
      : Promise.resolve([]),
  ]);
  const candidates = sources.flatMap((source) => {
    if (source.status === 'fulfilled') return source.value;
    console.error('Palette: management source failed', source.reason);
    return [];
  });
  return matchManagementCandidates(candidates, query);
};

const PROVIDERS: Provider[] = [searchOrders, searchPatients, searchLetters, searchItems, searchManagement];

/** Every provider in parallel; one that fails is left out instead of failing the palette. */
export async function searchPaletteEntityHits(
  tenant: TenantActionContext,
  query: string,
  slug: string,
): Promise<PaletteEntityHit[]> {
  let itemsLoad: Promise<ItemRecord[]> | null = null;
  const shared: SharedLoads = {
    items: () =>
      (itemsLoad ??= inventoryCookie().then((cookie) => listItems({ ...inventoryScope(tenant.businessId) }, cookie))),
  };
  const results = await Promise.allSettled(PROVIDERS.map((provider) => provider(tenant, query, slug, shared)));
  return results.flatMap((result) => {
    if (result.status === 'fulfilled') return result.value;
    console.error('Palette: entity search failed', result.reason);
    return [];
  });
}
