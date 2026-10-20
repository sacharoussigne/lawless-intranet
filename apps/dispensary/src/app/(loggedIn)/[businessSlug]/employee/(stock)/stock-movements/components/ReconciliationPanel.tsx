'use client';

import { Alert, Badge, Group, Paper, SimpleGrid, Stack, Text, Title } from '@mantine/core';
import { IconAlertTriangle } from '@tabler/icons-react';
import type { StockMovementReconciliationResult } from '@/types/stock';

interface ReconciliationPanelProps {
  data: StockMovementReconciliationResult | undefined;
  loading: boolean;
  itemSelected: boolean;
}

export function ReconciliationPanel({ data, loading, itemSelected }: ReconciliationPanelProps) {
  return (
    <Paper shadow="sm" p="md" withBorder>
      <Stack gap="md">
        <Title order={4} className="disp-display-title">
          Réconciliation
        </Title>
        <Text size="sm" c="dimmed">
          Compare le delta de stock réel sur la période avec la somme des mouvements audités pour
          l&apos;item sélectionné.
        </Text>

        {!itemSelected && (
          <Text size="sm" c="dimmed">
            Sélectionnez un item pour afficher la réconciliation.
          </Text>
        )}

        {itemSelected && loading && (
          <Text size="sm" c="dimmed">
            Calcul en cours...
          </Text>
        )}

        {data && (
          <Stack gap="sm">
            {!data.stockReconciliationAvailable && (
              <Alert color="amber" variant="light">
                Le filtre « Sans coffre » ne permet pas de comparer les snapshots de stock. Seule
                la somme des mouvements sans coffre est affichée.
              </Alert>
            )}

            {data.stockReconciliationAvailable && (
              <SimpleGrid cols={{ base: 2, sm: 4 }} spacing="md">
                <div>
                  <Text size="xs" c="dimmed">
                    Stock début période
                  </Text>
                  <Text fw={600}>{data.stockAtPeriodStart ?? '—'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Stock fin période
                  </Text>
                  <Text fw={600}>{data.stockAtPeriodEnd ?? '—'}</Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Delta stock réel
                  </Text>
                  <Text fw={600} c={data.stockDelta >= 0 ? 'moss' : 'danger'}>
                    {data.stockDelta > 0 ? `+${data.stockDelta}` : data.stockDelta}
                  </Text>
                </div>
                <div>
                  <Text size="xs" c="dimmed">
                    Somme mouvements
                  </Text>
                  <Text fw={600} c={data.movementsSum >= 0 ? 'moss' : 'danger'}>
                    {data.movementsSum > 0 ? `+${data.movementsSum}` : data.movementsSum}
                  </Text>
                </div>
              </SimpleGrid>
            )}

            {!data.stockReconciliationAvailable && (
              <div>
                <Text size="xs" c="dimmed">
                  Somme mouvements (sans coffre)
                </Text>
                <Text fw={600} c={data.movementsSum >= 0 ? 'moss' : 'danger'}>
                  {data.movementsSum > 0 ? `+${data.movementsSum}` : data.movementsSum}
                </Text>
              </div>
            )}

            {data.stockReconciliationAvailable && (
              <Group gap="sm">
                <Text size="sm">Écart :</Text>
                <Badge variant="outline" color={data.hasGap ? 'danger' : 'moss'} radius="sm">
                  {data.gap > 0 ? `+${data.gap}` : data.gap}
                </Badge>
                {!data.hasGap && <Text size="sm" c="dimmed">Cohérent</Text>}
              </Group>
            )}

            {data.hasGap && (
              <Alert color="amber" variant="light" icon={<IconAlertTriangle size={16} />}>
                Un écart existe entre le stock enregistré et les mouvements audités. Causes
                possibles : saisie « sans historique », transfert ou overwrite non tracé, ou
                mouvements sans coffre (données anciennes).
              </Alert>
            )}

            {data.movementsWithoutChest > 0 && data.chestFilter === 'all' && (
              <Text size="xs" c="dimmed">
                {data.movementsWithoutChest} mouvement(s) sans coffre sur cette période (données
                antérieures à l&apos;instrumentation).
              </Text>
            )}
          </Stack>
        )}
      </Stack>
    </Paper>
  );
}
