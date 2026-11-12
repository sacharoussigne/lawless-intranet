'use client';

import { type KeyboardEvent, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Kbd, Modal, Text, TextInput } from '@mantine/core';
import { useWindowEvent } from '@mantine/hooks';
import { IconSearch } from '@tabler/icons-react';
import { hasRole } from '@lawless-intranet/auth-permissions';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { usePermissions } from '@/app/_contexts/PermissionsContext';
import { isPlatformAdmin } from '@/lib/business/platformAdmin';
import {
  type CommandEntry,
  filterCommandEntries,
  getCommandPaletteEntries,
} from '@/lib/navigation/commandPalette';
import { Role } from '@/types/enum/roles';
import { tenantRoutes } from '@/types/routes';
import classes from './CommandPalette.module.scss';

/** Typing in a field, or a dialog already open: « / » is just a character there. */
function ignoresShortcut(event: globalThis.KeyboardEvent): boolean {
  const target = event.target as HTMLElement | null;
  if (target?.closest('input, textarea, select, [contenteditable=""], [contenteditable="true"]')) return true;
  return Boolean(document.querySelector('[role="dialog"]'));
}

/**
 * « / » anywhere in a business: jump to a page or start a quick action (« lettres », « paie »,
 * « créer commande »). Entries follow the user's rights and the enabled modules; no request.
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
  const results = useMemo(() => filterCommandEntries(entries, query), [entries, query]);
  // Pages first, then actions; one list for the keyboard.
  const ordered = useMemo(
    () => [...results.filter((entry) => entry.group === 'page'), ...results.filter((entry) => entry.group === 'action')],
    [results],
  );
  const active = Math.min(focused, Math.max(ordered.length - 1, 0));

  const go = (entry: CommandEntry) => {
    onClose();
    router.push(entry.href);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setFocused(Math.min(active + 1, ordered.length - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setFocused(Math.max(active - 1, 0));
    } else if (event.key === 'Enter' && ordered[active]) {
      event.preventDefault();
      go(ordered[active]);
    }
  };

  const renderGroup = (group: CommandEntry['group'], title: string) => {
    const items = ordered.filter((entry) => entry.group === group);
    if (items.length === 0) return null;
    return (
      <div role="group" aria-label={title}>
        <Text className={classes.groupTitle}>{title}</Text>
        {items.map((entry) => {
          const index = ordered.indexOf(entry);
          const EntryIcon = entry.icon;
          return (
            <Link
              key={entry.id}
              href={entry.href}
              className={classes.item}
              data-active={index === active || undefined}
              role="option"
              aria-selected={index === active}
              onMouseMove={() => setFocused(index)}
              onClick={(event) => {
                // Plain click: close then navigate; middle / modified click: new tab as usual.
                if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
                event.preventDefault();
                go(entry);
              }}
            >
              <EntryIcon size={18} stroke={1.6} className={classes.itemIcon} />
              <span className={classes.itemLabel}>{entry.label}</span>
              {entry.section ? <span className={classes.itemSection}>{entry.section}</span> : null}
            </Link>
          );
        })}
      </div>
    );
  };

  return (
    <>
      <div className={classes.searchBar}>
        <TextInput
          data-autofocus
          variant="unstyled"
          size="md"
          placeholder="Aller à… (lettres, salaires, créer une commande)"
          leftSection={<IconSearch size={18} />}
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
        {ordered.length === 0 ? (
          <Text size="sm" c="dimmed" ta="center" py="lg">
            Aucune page ni action pour « {query.trim()} ».
          </Text>
        ) : (
          <>
            {renderGroup('page', 'Pages')}
            {renderGroup('action', 'Actions')}
          </>
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
          <Kbd size="xs">Échap</Kbd> pour fermer
        </span>
      </div>
    </>
  );
}
