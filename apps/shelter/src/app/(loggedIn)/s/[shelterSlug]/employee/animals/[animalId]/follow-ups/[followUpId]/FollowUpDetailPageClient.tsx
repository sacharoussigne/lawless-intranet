'use client';

import { type ReactNode, useState } from 'react';
import { Badge, Button, Container, Group, Text, Title } from '@mantine/core';
import { IconArrowLeft } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { usePermissions, useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { ANIMAL_STATUS_LABELS } from '@/lib/animals/labels';
import type { AnimalDTO } from '../../../types';
import { FollowUpThread } from '../../FollowUpThread';
import classes from '../../FollowUps.module.scss';
import type { FollowUpDTO } from '../../followUpTypes';

function SideField({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={classes.sideField}>
      <div className={classes.sideFieldLabel}>{label}</div>
      <Text className={classes.sideFieldValue} size="sm">
        {value || '—'}
      </Text>
    </div>
  );
}

export function FollowUpDetailPageClient({
  shelterSlug,
  animal,
  initialFollowUp,
}: {
  shelterSlug: string;
  animal: AnimalDTO;
  initialFollowUp: FollowUpDTO;
}) {
  const router = useRouter();
  const t = useTenantRoutes();
  const { permissions } = usePermissions();
  const canUpdate = Boolean(permissions?.animals.update);
  const [followUp, setFollowUp] = useState(initialFollowUp);

  return (
    <Container size="xl">
      <Group mb="md">
        <Button
          variant="subtle"
          color="terracotta"
          leftSection={<IconArrowLeft size={16} />}
          onClick={() => router.push(t.employee.animal(animal.id))}
        >
          Retour
        </Button>
      </Group>

      <div className={classes.detailLayout}>
        <div className={classes.detailThread}>
          <FollowUpThread
            shelterSlug={shelterSlug}
            followUp={followUp}
            canUpdate={canUpdate}
            onUpdated={setFollowUp}
            fullPage
          />
        </div>

        <aside className={classes.animalSidePanel}>
          <div className={classes.animalSideTitle}>
            <Title order={3} className="shelter-display-title">
              {animal.name}
            </Title>
            <Badge size="md" radius="sm" color="terracotta" variant="filled">
              {ANIMAL_STATUS_LABELS[animal.status]}
            </Badge>
          </div>
          <SideField label="Espèce" value={animal.species.name} />
          <SideField label="Race" value={animal.breed.name} />
          <SideField label="Responsable" value={animal.caseManagerName} />
          <SideField label="Biographie" value={animal.biography} />
          <SideField label="Soins prodigués" value={animal.careProvided} />
          <SideField label="Notes" value={animal.notes} />
        </aside>
      </div>
    </Container>
  );
}
