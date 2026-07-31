'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Button,
  Group,
  MultiSelect,
  Paper,
  Stack,
  Switch,
  Text,
  Title,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import type { RoleChestAccessRow } from '@/app/_actions/chestAccess';
import type { ChestWithStockHistory } from '@/types/chests';
import { DISPENSARY_MEMBER_ROLES, Role, rolesAsString } from '@/types/enum/roles';
import { sortChests } from '@/lib/chests/sortChests';
import {
  useRoleChestAccesses,
  useUpsertRoleChestAccessMutation,
} from '../hooks/useChestsQueries';

type DraftAccess = {
  allChests: boolean;
  chestIds: string[];
};

interface ChestAccessTabPanelProps {
  initialChests: ChestWithStockHistory[];
  initialAccesses: RoleChestAccessRow[];
}

function toDraftMap(accesses: RoleChestAccessRow[]): Record<string, DraftAccess> {
  const map: Record<string, DraftAccess> = {};
  for (const access of accesses) {
    map[access.role] = {
      allChests: access.allChests,
      chestIds: access.chestIds,
    };
  }
  return map;
}

export function ChestAccessTabPanel({
  initialChests,
  initialAccesses,
}: ChestAccessTabPanelProps) {
  const { data: accesses = initialAccesses } = useRoleChestAccesses(initialAccesses);
  const upsertMutation = useUpsertRoleChestAccessMutation();

  const [drafts, setDrafts] = useState<Record<string, DraftAccess>>(() =>
    toDraftMap(initialAccesses),
  );
  const [savingRole, setSavingRole] = useState<string | null>(null);

  useEffect(() => {
    setDrafts(toDraftMap(accesses));
  }, [accesses]);

  const chestOptions = useMemo(
    () =>
      sortChests(initialChests).map((chest) => ({
        value: chest.id,
        label: chest.isEnabled ? chest.name : `${chest.name} (désactivé)`,
      })),
    [initialChests],
  );

  const serverByRole = useMemo(() => {
    const map = new Map(accesses.map((a) => [a.role, a]));
    return map;
  }, [accesses]);

  const isDirty = (role: string) => {
    if (role === Role.ADMIN) return false;
    const draft = drafts[role];
    const server = serverByRole.get(role);
    if (!draft || !server) return false;
    if (draft.allChests !== server.allChests) return true;
    if (draft.allChests) return false;
    const a = [...draft.chestIds].sort().join(',');
    const b = [...server.chestIds].sort().join(',');
    return a !== b;
  };

  const handleSave = async (role: string) => {
    const draft = drafts[role];
    if (!draft || role === Role.ADMIN) return;
    setSavingRole(role);
    try {
      await upsertMutation.mutateAsync({
        role,
        allChests: draft.allChests,
        chestIds: draft.allChests ? [] : draft.chestIds,
      });
    } finally {
      setSavingRole(null);
    }
  };

  const handleSaveAll = async () => {
    const dirtyRoles = DISPENSARY_MEMBER_ROLES.filter(
      (role) => role !== Role.ADMIN && isDirty(role),
    );
    if (dirtyRoles.length === 0) {
      notifications.show({
        title: 'Info',
        message: 'Aucune modification à enregistrer',
        color: 'slate',
      });
      return;
    }
    for (const role of dirtyRoles) {
      await handleSave(role);
    }
  };

  return (
    <Stack gap="md">
      <Group justify="space-between" align="flex-start">
        <Text c="dimmed" size="sm" maw={640}>
          Configurez les coffres accessibles par rôle (stock, prendre/déposer, transfert, craft,
          ventes). Sans configuration, un rôle n&apos;a accès à aucun coffre. L&apos;administrateur
          a toujours accès à tous les coffres.
        </Text>
        <Button
          onClick={() => void handleSaveAll()}
          loading={upsertMutation.isPending && savingRole === null}
        >
          Tout enregistrer
        </Button>
      </Group>

      {DISPENSARY_MEMBER_ROLES.map((role) => {
        const draft = drafts[role] ?? { allChests: false, chestIds: [] };
        const isAdmin = role === Role.ADMIN;
        const dirty = isDirty(role);

        return (
          <Paper key={role} p="md" withBorder radius="md">
            <Stack gap="sm">
              <Group justify="space-between" align="center">
                <Title order={4} className="disp-display-title">
                  {rolesAsString(role)}
                </Title>
                {!isAdmin && (
                  <Button
                    size="xs"
                    variant={dirty ? 'filled' : 'light'}
                    disabled={!dirty}
                    loading={upsertMutation.isPending && savingRole === role}
                    onClick={() => void handleSave(role)}
                  >
                    Enregistrer
                  </Button>
                )}
              </Group>

              <Switch
                label="Tous les coffres"
                checked={isAdmin ? true : draft.allChests}
                disabled={isAdmin}
                description={
                  isAdmin
                    ? 'Accès permanent à tous les coffres (non modifiable)'
                    : 'Accès à tous les coffres actuels et futurs'
                }
                onChange={(event) => {
                  const allChests = event.currentTarget.checked;
                  setDrafts((prev) => ({
                    ...prev,
                    [role]: {
                      allChests,
                      chestIds: allChests ? [] : prev[role]?.chestIds ?? [],
                    },
                  }));
                }}
              />

              {!isAdmin && !draft.allChests && (
                <MultiSelect
                  label="Coffres autorisés"
                  placeholder="Sélectionner des coffres"
                  data={chestOptions}
                  value={draft.chestIds}
                  searchable
                  clearable
                  onChange={(chestIds) => {
                    setDrafts((prev) => ({
                      ...prev,
                      [role]: {
                        allChests: false,
                        chestIds,
                      },
                    }));
                  }}
                />
              )}
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}
