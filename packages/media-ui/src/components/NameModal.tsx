'use client';

import { useState, type FormEvent } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { splitExtension } from '../format';

type NameModalProps = {
  opened: boolean;
  title: string;
  label: string;
  submitLabel: string;
  initialValue?: string;
  /** Pre-selects the name without its extension (file rename). */
  selectBaseName?: boolean;
  loading?: boolean;
  onSubmit: (name: string) => void;
  onClose: () => void;
};

/** Create a folder or rename an item. Remounted on open, so the field starts fresh. */
export function NameModal(props: NameModalProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={props.title} centered>
      {props.opened ? <NameForm {...props} /> : null}
    </Modal>
  );
}

function NameForm({
  label,
  submitLabel,
  initialValue = '',
  selectBaseName = false,
  loading = false,
  onSubmit,
  onClose,
}: NameModalProps) {
  const [value, setValue] = useState(initialValue);
  const trimmed = value.trim();

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit}>
      <Stack gap="md">
        <TextInput
          label={label}
          value={value}
          onChange={(event) => setValue(event.currentTarget.value)}
          maxLength={255}
          data-autofocus
          onFocus={(event) => {
            const input = event.currentTarget;
            const end = selectBaseName ? splitExtension(input.value).base.length : input.value.length;
            input.setSelectionRange(0, end);
          }}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" disabled={!trimmed || trimmed === initialValue} loading={loading}>
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
