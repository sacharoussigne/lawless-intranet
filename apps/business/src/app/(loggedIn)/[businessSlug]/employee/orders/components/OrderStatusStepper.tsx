'use client';

import { Button, Group, Text } from '@mantine/core';
import { IconArrowRight, IconBan, IconCheck, IconRefresh } from '@tabler/icons-react';
import type { OrderStatus } from '@lawless-intranet/types';
import { getOrderStatusLabel } from '@/types/enum/orderStatus';
import {
  nextOrderStatus,
  ORDER_STATUS_STEPS,
  orderStatusStepIndex,
} from '@/lib/orders/statusSteps';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import classes from './OrderStatusStepper.module.scss';

type OrderStatusProps = {
  status: OrderStatus;
  /** Moves are offered only to who may update the order. */
  canChange: boolean;
  pending?: boolean;
  /** Called with the target status; COMPLETED is handled by the caller (stock step). */
  onChange: (status: OrderStatus) => void;
};

/** Path of an order (Brouillon → … → Terminée) on one line; a click on a step moves to it. */
export function OrderStatusSteps({ status, canChange, pending, onChange }: OrderStatusProps) {
  const isCancelled = status === 'CANCELLED';
  const isCompleted = status === 'COMPLETED';
  const active = isCompleted ? ORDER_STATUS_STEPS.length : orderStatusStepIndex(status);
  const interactive = canChange && !isCancelled && !isCompleted && !pending;

  return (
    <ol className={isCancelled ? `${classes.steps} ${classes.cancelled}` : classes.steps}>
      {ORDER_STATUS_STEPS.map((step, index) => {
        const state = index < active ? 'done' : index === active ? 'current' : 'todo';
        const content = (
          <>
            <span className={classes.dot} aria-hidden>
              {state === 'done' ? <IconCheck size={14} stroke={3} /> : index + 1}
            </span>
            <span className={classes.label}>{getOrderStatusLabel(step)}</span>
          </>
        );
        return (
          <li
            key={step}
            className={`${classes.step} ${classes[state]}`}
            aria-current={state === 'current' ? 'step' : undefined}
          >
            {interactive && step !== status ? (
              <button
                type="button"
                className={classes.stepButton}
                onClick={() => onChange(step)}
                title={`Passer à « ${getOrderStatusLabel(step)} »`}
              >
                {content}
              </button>
            ) : (
              <span className={classes.stepContent}>{content}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Workflow buttons of an order: cancel, or move to the next step (reactivate when cancelled). */
export function OrderStatusActions({ status, canChange, pending, onChange }: OrderStatusProps) {
  const isCancelled = status === 'CANCELLED';
  const next = nextOrderStatus(status);
  if (!canChange || status === 'COMPLETED') return null;

  return (
    <Group justify="space-between" gap="xs">
      {isCancelled ? (
        <>
          <Text size="sm" c="dimmed">
            Commande annulée
          </Text>
          <Button
            variant="light"
            leftSection={<IconRefresh size={16} />}
            loading={pending}
            onClick={() => onChange('DRAFT')}
          >
            Réactiver en brouillon
          </Button>
        </>
      ) : (
        <>
          <DeleteConfirmPopover
            title="Annuler la commande ?"
            message="Elle sort du parcours ; vous pourrez la réactiver en brouillon."
            confirmLabel="Annuler la commande"
            position="bottom-start"
            onConfirm={() => onChange('CANCELLED')}
          >
            <Button
              variant="subtle"
              color="danger"
              leftSection={<IconBan size={16} />}
              disabled={pending}
            >
              Annuler la commande
            </Button>
          </DeleteConfirmPopover>
          {next && (
            <Button
              rightSection={<IconArrowRight size={16} />}
              loading={pending}
              onClick={() => onChange(next)}
            >
              {next === 'COMPLETED'
                ? 'Terminer la commande'
                : `Passer à « ${getOrderStatusLabel(next)} »`}
            </Button>
          )}
        </>
      )}
    </Group>
  );
}
