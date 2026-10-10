'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Anchor, Badge, Button, Group, Stack, Text, UnstyledButton } from '@mantine/core';
import { IconArrowsExchange2, IconCash, IconChevronDown, IconClipboardList } from '@tabler/icons-react';
import Link from 'next/link';
import {
  InventoryUiProvider,
  TakeDepositModal,
  type InventoryUiPermissions,
} from '@lawless-intranet/inventory-ui';
import { SaleModal } from '@/app/_components/sales/SaleModal';
import { usePermissions, useRequiredDispensarySlug } from '@/app/_contexts/PermissionsContext';
import { createDispensaryInventoryActions } from '@/lib/inventory/inventoryUiActions';
import type { ChestListItem } from '@/types/chests';
import type { OrdersPageResult } from '@/types/orders';
import type { OrderMailTemplateAssignment } from '@/types/mailTemplates';
import { tenantRoutes } from '@/types/routes';
import {
  defaultActiveOrdersPageFilters,
  useOrdersPage,
} from './orders/hooks/useOrdersQueries';
import { EmployeeActiveOrdersDashboard } from './EmployeeActiveOrdersDashboard';
import classes from './EmployeeQuickActions.module.scss';

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

  const preferenceReady = ordersVisible != null;
  const ordersExpanded = preferenceReady && ordersVisible;
  const ordersHref = tenantRoutes(dispensarySlug).orders.index;

  // Desktop: toggle next to the actions, list below. Phones: one bordered panel (see the SCSS).
  return (
    <Group justify="space-between" align="center" wrap="wrap" gap="md" mb="lg">
      <Group gap="sm" wrap="nowrap" w={{ base: "100%", sm: "auto" }}>
        {leadingActions}
      </Group>

      {preferenceReady && (
        <div className={classes.ordersPanel}>
          <UnstyledButton
            className={classes.ordersToggle}
            onClick={() => setOrdersVisible((current) => !current)}
            aria-expanded={ordersExpanded}
          >
            <Group gap="xs" align="center" wrap="nowrap" className={classes.ordersToggleInner}>
              <Group gap="xs" align="center" wrap="nowrap">
                <IconClipboardList size={20} className={classes.ordersIcon} />
                <Text className="disp-display-title" style={{ fontSize: '1.15rem' }}>
                  Commandes en cours
                </Text>
                <Badge variant={activeCount > 0 ? 'filled' : 'light'} color="sage" radius="lg" size="lg">
                  {activeCount}
                </Badge>
              </Group>
              <Group gap={4} align="center" wrap="nowrap">
                <span className={classes.ordersHint}>{ordersExpanded ? 'Masquer' : 'Afficher'}</span>
                <IconChevronDown
                  size={18}
                  style={{
                    transform: ordersExpanded ? 'rotate(180deg)' : undefined,
                    transition: 'transform 150ms ease',
                  }}
                />
              </Group>
            </Group>
          </UnstyledButton>

          {ordersExpanded && (
            <Stack gap="sm" className={classes.ordersContent}>
              <Group justify="flex-end" visibleFrom="sm">
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
        </div>
      )}
    </Group>
  );
}

/** Phones: the two actions share the width (default 36px height, as on desktop). */
const MOBILE_ACTION_BUTTON = { flex: { base: 1, sm: "none" } } as const;

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
  const { permissions } = usePermissions();
  const requiredSlug = useRequiredDispensarySlug();
  const scopeSlug = dispensarySlug ?? requiredSlug;
  const inventoryActions = useMemo(
    () => createDispensaryInventoryActions(scopeSlug),
    [scopeSlug],
  );
  const inventoryPermissions: InventoryUiPermissions = useMemo(
    () => ({
      stock: {
        update: Boolean(permissions?.stock.update),
        hide: Boolean(permissions?.stock.hide),
        craftRead: Boolean(permissions?.stock.craftRead),
        craftWrite: Boolean(permissions?.stock.craftWrite),
      },
    }),
    [permissions],
  );

  const showOrdersSlot = Boolean(dispensarySlug && initialOrdersPage);
  const showActionButtons = canCreateSale || canTakeStock;

  if (!showActionButtons && !showOrdersSlot) {
    return null;
  }

  const leadingActions = (
    <>
      {canCreateSale && (
        <Button
          leftSection={<IconCash size={16} />}
          onClick={() => setSaleOpened(true)}
          {...MOBILE_ACTION_BUTTON}
        >
          Vente
        </Button>
      )}
      {canTakeStock && (
        <Button
          leftSection={<IconArrowsExchange2 size={16} />}
          variant="light"
          color="clay"
          onClick={() => setTakeOpened(true)}
          {...MOBILE_ACTION_BUTTON}
        >
          Déposer / Prendre
        </Button>
      )}
    </>
  );

  return (
    <InventoryUiProvider
      scopeKey={scopeSlug}
      actions={inventoryActions}
      permissions={inventoryPermissions}
    >
      {showOrdersSlot && dispensarySlug && initialOrdersPage ? (
        <ActiveOrdersChrome
          dispensarySlug={dispensarySlug}
          initialOrdersPage={initialOrdersPage}
          initialAssignments={initialAssignments}
          leadingActions={leadingActions}
        />
      ) : (
        <Group mb="lg" gap="sm" wrap="nowrap" w={{ base: "100%", sm: "auto" }}>
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
    </InventoryUiProvider>
  );
}
