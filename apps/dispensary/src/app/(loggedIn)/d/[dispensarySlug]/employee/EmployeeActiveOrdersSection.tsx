'use client';

import { useCallback, useEffect, useState } from 'react';
import { Anchor, Badge, Group, Stack, Switch, Text } from '@mantine/core';
import Link from 'next/link';
import { tenantRoutes } from '@/types/routes';
import type { OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { EmployeeActiveOrdersDashboard } from './EmployeeActiveOrdersDashboard';

const ORDERS_VISIBLE_STORAGE_KEY = 'employee-home-orders-visible';

function readOrdersVisiblePreference(): boolean {
  try {
    const raw = window.localStorage.getItem(ORDERS_VISIBLE_STORAGE_KEY);
    if (raw == null) return false;
    return JSON.parse(raw) === true;
  } catch {
    return false;
  }
}

type EmployeeActiveOrdersSectionProps = {
  dispensarySlug: string;
  initialOrdersPage: OrdersPageResult;
  initialAssignments: OrderMailTemplateAssignment[];
};

export function EmployeeActiveOrdersSection({
  dispensarySlug,
  initialOrdersPage,
  initialAssignments,
}: EmployeeActiveOrdersSectionProps) {
  const [ordersVisible, setOrdersVisible] = useState<boolean | null>(null);
  const [activeCount, setActiveCount] = useState(initialOrdersPage.totalCount);

  useEffect(() => {
    setOrdersVisible(readOrdersVisiblePreference());
  }, []);

  useEffect(() => {
    if (ordersVisible == null) return;
    try {
      window.localStorage.setItem(ORDERS_VISIBLE_STORAGE_KEY, JSON.stringify(ordersVisible));
    } catch {
      // Ignore quota / private mode write failures.
    }
  }, [ordersVisible]);

  const handleActiveCountChange = useCallback((count: number) => {
    setActiveCount(count);
  }, []);

  if (activeCount <= 0) {
    return null;
  }

  const preferenceReady = ordersVisible != null;
  const ordersSectionVisible = preferenceReady && ordersVisible;
  const ordersHref = tenantRoutes(dispensarySlug).orders.index;

  return (
    <Stack gap="md" mt="xl" mb="xl">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="sm" align="center">
          <Text
            className="disp-display-title"
            style={{ cursor: preferenceReady ? 'pointer' : undefined }}
            onClick={() => {
              if (!preferenceReady) return;
              setOrdersVisible((current) => !current);
            }}
          >
            Commandes en cours
          </Text>
          <Badge variant="filled" color="sage" radius="lg" size="lg">
            {activeCount}
          </Badge>
        </Group>
        <Group gap="md" align="center">
          {preferenceReady && (
            <Switch
              label="Afficher les commandes"
              checked={ordersVisible}
              onChange={(event) => setOrdersVisible(event.currentTarget.checked)}
              size="sm"
            />
          )}
          <Anchor component={Link} href={ordersHref} size="sm" c="dimmed">
            Voir toutes
          </Anchor>
        </Group>
      </Group>

      {ordersSectionVisible && (
        <EmployeeActiveOrdersDashboard
          initialOrdersPage={initialOrdersPage}
          initialAssignments={initialAssignments}
          onActiveCountChange={handleActiveCountChange}
        />
      )}
    </Stack>
  );
}
