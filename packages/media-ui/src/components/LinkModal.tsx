'use client';

import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { useState, type FormEvent } from 'react';
import { Button, Group, Modal, Stack, TextInput } from '@mantine/core';
import { linkHost, normalizeLinkUrl } from '../format';

export type LinkFormValues = { name: string; url: string };

type LinkModalProps = {
  opened: boolean;
  title: string;
  submitLabel: string;
  initialValues?: LinkFormValues;
  loading?: boolean;
  onSubmit: (values: LinkFormValues) => void;
  onClose: () => void;
};

/** Add or edit a link (name + address). Remounted on open, so the fields start fresh. */
export function LinkModal(props: LinkModalProps) {
  return (
    <Modal opened={props.opened} onClose={props.onClose} title={props.title} centered>
      {props.opened ? <LinkForm {...props} /> : null}
    </Modal>
  );
}

function LinkForm({ submitLabel, initialValues, loading = false, onSubmit, onClose }: LinkModalProps) {
  const [url, setUrl] = useState(initialValues?.url ?? '');
  const [name, setName] = useState(initialValues?.name ?? '');
  const [urlTouched, setUrlTouched] = useState(false);

  const normalizedUrl = normalizeLinkUrl(url);
  const trimmedName = name.trim();
  const unchanged =
    initialValues !== undefined && trimmedName === initialValues.name && normalizedUrl === initialValues.url;
  const urlError =
    urlTouched && url.trim() && !normalizedUrl ? 'Adresse invalide : elle doit commencer par https:// ou http://' : null;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!normalizedUrl) {
      setUrlTouched(true);
      return;
    }
    onSubmit({ name: trimmedName, url: normalizedUrl });
  };

  return (
    <form {...noAutofillProps} onSubmit={handleSubmit}>
      <Stack gap="md">
        <TextInput
          label="Adresse"
          placeholder="https://"
          type="url"
          value={url}
          onChange={(event) => setUrl(event.currentTarget.value)}
          onBlur={() => setUrlTouched(true)}
          error={urlError}
          maxLength={2048}
          required
          data-autofocus
        />
        <TextInput
          label="Nom"
          description={
            initialValues ? undefined : 'Facultatif : sans nom, le lien prend le nom du site.'
          }
          placeholder={normalizedUrl ? linkHost(normalizedUrl) : undefined}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          maxLength={255}
          required={initialValues !== undefined}
        />
        <Group justify="flex-end" gap="sm">
          <Button variant="subtle" color="slate" onClick={onClose}>
            Annuler
          </Button>
          <Button
            type="submit"
            disabled={!url.trim() || (initialValues !== undefined && !trimmedName) || unchanged}
            loading={loading}
          >
            {submitLabel}
          </Button>
        </Group>
      </Stack>
    </form>
  );
}
