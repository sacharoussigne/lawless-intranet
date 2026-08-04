'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Anchor, Badge, Button, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsExchange2, IconCash, IconChevronDown } from '@tabler/icons-react';
import Link from 'next/link';
import { SaleModal } from '@/app/_components/sales/SaleModal';
import TakeDepositModal from '@/app/(loggedIn)/d/[dispensarySlug]/stock/modals/TakeModal';
import type { ChestListItem } from '@/types/chests';
import type { OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { tenantRoutes } from '@/types/routes';
import {
  defaultActiveOrdersPageFilters,
  useOrdersPage,
} from '../orders/hooks/useOrdersQueries';
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

type ActiveOrdersChromeProps = {
  dispensarySlug: string;
  initialOrdersPage: OrdersPageResult;
  initialAssignments: OrderMailTemplateAssignment[];
  leadingActions: ReactNode;
};

function ActiveOrdersChrome({
  dispensarySlug,
  initialOrdersPage,
  initialAssignments,
  leadingActions,
}: ActiveOrdersChromeProps) {
  const [ordersVisible, setOrdersVisible] = useState<boolean | null>(null);

  const { data: summaryPage } = useOrdersPage(
    defaultActiveOrdersPageFilters,
    initialOrdersPage,
    defaultActiveOrdersPageFilters,
  );

  const activeCount = summaryPage?.totalCount ?? initialOrdersPage.totalCount;

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

  if (activeCount <= 0) {
    return <Group mb="lg">{leadingActions}</Group>;
  }

  const preferenceReady = ordersVisible != null;
  const ordersExpanded = preferenceReady && ordersVisible;
  const ordersHref = tenantRoutes(dispensarySlug).orders.index;

  return (
    <Stack gap="md" mb="lg">
      <Group justify="space-between" align="center" wrap="wrap">
        <Group gap="sm">{leadingActions}</Group>

        {preferenceReady && (
          <UnstyledButton
            onClick={() => setOrdersVisible((current) => !current)}
            aria-expanded={ordersVisible}
          >
            <Group gap="xs" align="center" wrap="nowrap">
              <Text className="disp-display-title" style={{ fontSize: '1.15rem' }}>
                Commandes en cours
              </Text>
              <Badge variant="filled" color="sage" radius="lg" size="lg">
                {activeCount}
              </Badge>
              <IconChevronDown
                size={18}
                style={{
                  transform: ordersVisible ? 'rotate(180deg)' : undefined,
                  transition: 'transform 150ms ease',
                }}
              />
            </Group>
          </UnstyledButton>
        )}
      </Group>

      {ordersExpanded && (
        <Stack gap="sm">
          <Group justify="flex-end">
            <Anchor component={Link} href={ordersHref} size="sm" c="dimmed">
              Voir toutes
            </Anchor>
          </Group>
          <EmployeeActiveOrdersDashboard
            initialOrdersPage={summaryPage ?? initialOrdersPage}
            initialAssignments={initialAssignments}
          />
        </Stack>
      )}
    </Stack>
  );
}

type EmployeeQuickActionsProps = {
  canCreateSale: boolean;
  canTakeStock: boolean;
  chests: ChestListItem[];
  dispensarySlug?: string;
  initialOrdersPage?: OrdersPageResult | null;
  initialAssignments?: OrderMailTemplateAssignment[];
};

export function EmployeeQuickActions({
  canCreateSale,
  canTakeStock,
  chests,
  dispensarySlug,
  initialOrdersPage = null,
  initialAssignments = [],
}: EmployeeQuickActionsProps) {
  const [saleOpened, setSaleOpened] = useState(false);
  const [takeOpened, setTakeOpened] = useState(false);

  const showOrdersSlot = Boolean(dispensarySlug && initialOrdersPage);
  const showActionButtons = canCreateSale || canTakeStock;

  if (!showActionButtons && !showOrdersSlot) {
    return null;
  }

  const leadingActions = (
    <>
      {canCreateSale && (
        <Button leftSection={<IconCash size={16} />} onClick={() => setSaleOpened(true)}>
          Vente
        </Button>
      )}
      {canTakeStock && (
        <Button
          leftSection={<IconArrowsExchange2 size={16} />}
          variant="light"
          color="clay"
          onClick={() => setTakeOpened(true)}
        >
          Prendre / Déposer
        </Button>
      )}
    </>
  );

  return (
    <>
      {showOrdersSlot && dispensarySlug && initialOrdersPage ? (
        <ActiveOrdersChrome
          dispensarySlug={dispensarySlug}
          initialOrdersPage={initialOrdersPage}
          initialAssignments={initialAssignments}
          leadingActions={leadingActions}
        />
      ) : (
        <Group mb="lg" gap="sm">
          {leadingActions}
        </Group>
      )}

      {canCreateSale && (
        <SaleModal opened={saleOpened} onClose={() => setSaleOpened(false)} chests={chests} />
      )}

      {canTakeStock && (
        <TakeDepositModal
          opened={takeOpened}
          onClose={() => setTakeOpened(false)}
          chests={chests}
        />
      )}
    </>
  );
}
