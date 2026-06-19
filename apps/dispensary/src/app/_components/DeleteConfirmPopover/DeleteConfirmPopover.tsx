'use client';

import { cloneElement, isValidElement, useState, type ReactElement, type ReactNode } from 'react';
import {
  Button,
  Group,
  Popover,
  Stack,
  Text,
  type PopoverProps,
} from '@mantine/core';
import classes from './DeleteConfirmPopover.module.scss';

type DeleteConfirmPopoverProps = {
  title: string;
  message: ReactNode;
  onConfirm: () => void | Promise<void>;
  position?: PopoverProps['position'];
  children: ReactElement<{ onClick?: (event: React.MouseEvent) => void }>;
};

export function DeleteConfirmPopover({
  title,
  message,
  onConfirm,
  position = 'bottom-end',
  children,
}: DeleteConfirmPopoverProps) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const trigger = isValidElement(children)
    ? cloneElement(children, {
        onClick: (event: React.MouseEvent) => {
          children.props.onClick?.(event);
          if (!event.defaultPrevented) {
            setOpen(true);
          }
        },
      })
    : children;

  const handleConfirm = async () => {
    setOpen(false);
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  return (
    <Popover
      position={position}
      withArrow
      shadow="md"
      opened={open}
      onChange={setOpen}
    >
      <Popover.Target>{trigger}</Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs" className={classes.root}>
          <Text size="sm" fw={500}>
            {title}
          </Text>
          <Text size="xs" c="dimmed">
            {message}
          </Text>
          <Group gap="xs" justify="flex-end" mt={4}>
            <Button
              size="xs"
              variant="subtle"
              color="slate"
              onClick={() => setOpen(false)}
              disabled={confirming}
            >
              Annuler
            </Button>
            <Button
              size="xs"
              color="danger"
              loading={confirming}
              onClick={() => void handleConfirm()}
            >
              Supprimer
            </Button>
          </Group>
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
}
