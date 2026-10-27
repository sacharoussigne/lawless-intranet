'use client';

import { useState } from 'react';
import { Button, Group, MultiSelect, Text } from '@mantine/core';
import { IconEye } from '@tabler/icons-react';
import { useBusinessTypeDefinition } from '@/app/_contexts/PermissionsContext';
import { parseRoleList, rolesAsString } from '@/types/enum/roles';
import { useViewAs } from './useViewAs';
import classes from './ViewAsBanner.module.scss';

/** Shown while an admin browses the business « en tant que » some roles (lib/business/viewAs). */
export function ViewAsBanner({ businessSlug, roles }: { businessSlug: string; roles: string }) {
  const { memberRoles } = useBusinessTypeDefinition();
  const viewAs = useViewAs(businessSlug);
  const current = parseRoleList(roles);
  const [selected, setSelected] = useState<string[]>(current);
  const changed = selected.slice().sort().join(',') !== current.slice().sort().join(',');

  return (
    <div className={classes.banner} role="status">
      <Group justify="space-between" gap="sm" wrap="wrap" className={classes.inner}>
        <Group gap="xs" wrap="nowrap">
          <IconEye size={18} />
          <Text size="sm" fw={600}>
            Tu visualises ce dispensaire en tant que {current.length} rôle{current.length > 1 ? 's' : ''}.
          </Text>
        </Group>
        <Group gap="xs" wrap="wrap">
          <MultiSelect
            size="xs"
            aria-label="Rôles de la vue"
            placeholder="Rechercher des rôles"
            data={memberRoles.map((role) => ({ value: role, label: rolesAsString(role) }))}
            value={selected}
            onChange={setSelected}
            searchable
            clearable={false}
            className={classes.select}
            comboboxProps={{ withinPortal: true }}
          />
          <Button
            size="xs"
            color="leather"
            disabled={!changed || selected.length === 0}
            loading={viewAs.pending}
            onClick={() => viewAs.change(selected)}
          >
            Appliquer
          </Button>
          <Button size="xs" variant="outline" color="leather" loading={viewAs.pending} onClick={viewAs.stop}>
            Désactiver
          </Button>
        </Group>
      </Group>
    </div>
  );
}
