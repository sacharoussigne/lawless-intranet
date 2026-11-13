'use client';

import { type KeyboardEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Kbd, Loader, Modal, Text, TextInput } from '@mantine/core';
import { useDebouncedValue, useWindowEvent } from '@mantine/hooks';
import {
  type Icon,
  IconBox,
  IconMailbox,
  IconNotebook,
  IconSearch,
  IconStethoscope,
  IconTools,
  IconUser,
} from '@tabler/icons-react';
import { useQuery } from '@tanstack/react-query';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { handleAction } from '@/lib/action';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import {
  type CommandEntry,
  filterCommandEntries,
  getCommandPaletteEntries,
  PALETTE_ENTITY_MIN_LENGTH,
  parsePaletteQuery,
} from '@/lib/navigation/commandPalette';
import { fetchRead } from '@/lib/read/fetchRead';
import type { PaletteEntityHit, PaletteEntityType } from '@/types/palette';
import { Role } from '@/types/enum/roles';
import { tenantRoutes } from '@/types/routes';
import classes from './CommandPalette.module.scss';

/** Sections of the « @ » search, in display order. */
const ENTITY_SECTIONS: { type: PaletteEntityType; title: string; icon: Icon }[] = [
  { type: 'order', title: 'Commandes', icon: IconNotebook },
  { type: 'patient', title: 'Patients', icon: IconStethoscope },
  { type: 'correspondent', title: 'Correspondants', icon: IconUser },
  { type: 'letter', title: 'Lettres', icon: IconMailbox },
  { type: 'item', title: 'Objets', icon: IconBox },
  { type: 'management', title: 'Gestion', icon: IconTools },
];

/** One row of the palette: a page, an action or an entity. */
type PaletteRow = { key: string; group: string; label: string; detail?: string; href: string; icon: Icon };

/** Typing in a field, or a dialog already open: « / » is just a character there. */
function ignoresShortcut(event: globalThis.KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  return Boolean(document.querySelector('[role="dialog"]'));
}

/**
 * « / » anywhere in a business: jump to a page or start a quick action (« lettres », « paie »,
 * « créer commande »), with no request. « @… » searches entities instead (orders, patients, letters,
 * items) on the server. Everything follows the user's rights and the enabled modules.
 */
export function CommandPalette({ businessSlug }: { businessSlug: string }) {
  const [opened, setOpened] = useState(false);

  useWindowEvent('keydown', (event) => {
    if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey || opened) return;
    if (ignoresShortcut(event)) return;
    event.preventDefault();
    setOpened(true);
  });

  return (
    <Modal
      opened={opened}
      onClose={() => setOpened(false)}
      withCloseButton={false}
      size="lg"
      padding={0}
      yOffset="12vh"
      classNames={{ content: classes.content }}
      aria-label="Aller à une page ou lancer une action"
    >
      {/* Mounted while open only: the query starts empty every time. */}
      {opened ? <CommandPaletteBody businessSlug={businessSlug} onClose={() => setOpened(false)} /> : null}
    </Modal>
  );
}

function CommandPaletteBody({ businessSlug, onClose }: { businessSlug: string; onClose: () => void }) {
  const router = useRouter();
  const {
    permissions,
    userRole,
    appSettings,
    agendaModuleAccess,
    cabinetModuleAccess,
    letterBoxModuleAccess,
    hasAccessibleChests,
  } = usePermissions();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);

  const entries = useMemo(
    () =>
      getCommandPaletteEntries({
        t: tenantRoutes(businessSlug),
        appSettings,
        permissions,
        userRole,
        agendaModuleAccess,
        cabinetModuleAccess,
        letterBoxModuleAccess,
        hasAccessibleChests,
        isAdmin: hasRole(userRole, Role.ADMIN),
        isPlatformAdmin: isPlatformAdmin(userRole),
      }),
    [
      businessSlug,
      appSettings,
      permissions,
      userRole,
      agendaModuleAccess,
      cabinetModuleAccess,
      letterBoxModuleAccess,
      hasAccessibleChests,
    ],
  );
  const parsed = parsePaletteQuery(query);
  const entityMode = parsed.mode === 'entities';
  const [entityQuery] = useDebouncedValue(entityMode ? parsed.text : '', 200);
  const entitySearch = useQuery({
    queryKey: ['palette', businessSlug, entityQuery],
    queryFn: async () => handleAction(await fetchRead(businessSlug, 'paletteSearch', { query: entityQuery })) ?? [],
    enabled: entityMode && entityQuery.length >= PALETTE_ENTITY_MIN_LENGTH,
    staleTime: 30_000,
  });

  // One list for the keyboard: pages then actions, or the entity sections.
  const rows = useMemo<PaletteRow[]>(() => {
    if (entityMode) {
      const hits: PaletteEntityHit[] = entitySearch.data ?? [];
      return ENTITY_SECTIONS.flatMap((section) =>
        hits
          .filter((hit) => hit.type === section.type)
          .map((hit) => ({
            key: `${hit.type}:${hit.id}`,
            group: section.title,
            label: hit.label,
            detail: hit.detail,
            href: hit.href,
            icon: section.icon,
          })),
      );
    }
    const results = filterCommandEntries(entries, parsed.text);
    const toRow = (entry: CommandEntry, group: string): PaletteRow => ({
      key: entry.id,
      group,
      label: entry.label,
      detail: entry.section,
      href: entry.href,
      icon: entry.icon,
    });
    return [
      ...results.filter((entry) => entry.group === 'page').map((entry) => toRow(entry, 'Pages')),
      ...results.filter((entry) => entry.group === 'action').map((entry) => toRow(entry, 'Actions')),
    ];
  }, [entityMode, entitySearch.data, entries, parsed.text]);
  const active = Math.min(focused, Math.max(rows.length - 1, 0));

  const go = (row: PaletteRow) => {
    onClose();
    router.push(row.href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocused(Math.min(active + 1, rows.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocused(Math.max(active - 1, 0));
    } else if (event.key === 'Enter' && rows[active]) {
      event.preventDefault();
      go(rows[active]);
    }
  };

  const groups = [...new Set(rows.map((row) => row.group))];
  const waitingForEntities = entityMode && entityQuery.length >= PALETTE_ENTITY_MIN_LENGTH && entitySearch.isFetching;

  const emptyMessage = !entityMode
    ? `Aucune page ni action pour « ${parsed.text} ». Pour chercher une commande, un patient ou une lettre : @${parsed.text}`
    : parsed.text.length < PALETTE_ENTITY_MIN_LENGTH
      ? 'Tapez un nom, un n° de commande ou de série… (2 caractères minimum)'
      : entitySearch.isError
        ? 'La recherche a échoué.'
        : waitingForEntities || parsed.text !== entityQuery
          ? null
          : `Rien trouvé pour « ${parsed.text} ».`;

  return (
    <>
      <div className={classes.searchBar}>
        <TextInput
          data-autofocus
          variant="unstyled"
          size="md"
          placeholder="Aller à… (lettres, salaires) ou @nom pour chercher"
          leftSection={<IconSearch size={18} />}
          rightSection={waitingForEntities ? <Loader size={16} color="sage" /> : null}
          value={query}
          onChange={(event) => {
            setQuery(event.currentTarget.value);
            setFocused(0);
          }}
          onKeyDown={handleKeyDown}
          aria-label="Rechercher une page ou une action"
          {...noAutofillProps}
        />
      </div>
      <div className={classes.results} role="listbox">
        {rows.length === 0 ? (
          emptyMessage ? (
            <Text size="sm" c="dimmed" ta="center" py="lg" px="md">
              {emptyMessage}
            </Text>
          ) : null
        ) : (
          groups.map((group) => (
            <div key={group} role="group" aria-label={group}>
              <Text className={classes.groupTitle}>{group}</Text>
              {rows
                .filter((row) => row.group === group)
                .map((row) => {
                  const index = rows.indexOf(row);
                  const RowIcon = row.icon;
                  return (
                    <Link
                      key={row.key}
                      href={row.href}
                      className={classes.item}
                      data-active={index === active || undefined}
                      role="option"
                      aria-selected={index === active}
                      onMouseMove={() => setFocused(index)}
                      onClick={(event) => {
                        // Plain click: close then navigate; middle / modified click: new tab as usual.
                        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
                        event.preventDefault();
                        go(row);
                      }}
                    >
                      <RowIcon size={18} stroke={1.6} className={classes.itemIcon} />
                      <span className={classes.itemLabel}>{row.label}</span>
                      {row.detail ? <span className={classes.itemSection}>{row.detail}</span> : null}
                    </Link>
                  );
                })}
            </div>
          ))
        )}
      </div>
      <div className={classes.footer}>
        <span>
          <Kbd size="xs">↑</Kbd> <Kbd size="xs">↓</Kbd> pour choisir
        </span>
        <span>
          <Kbd size="xs">Entrée</Kbd> pour ouvrir
        </span>
        <span>
          <Kbd size="xs">@</Kbd> commandes, patients, lettres, objets
        </span>
        <span>
          <Kbd size="xs">Échap</Kbd> pour fermer
        </span>
      </div>
    </>
  );
}
