'use client';

import { useMemo, useState } from 'react';
import {
  Badge,
  Button,
  FileButton,
  Group,
  Modal,
  Stack,
  Table,
  Text,
  Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconFileImport, IconUpload } from '@tabler/icons-react';
import { useBankUi, type ImportTransactionItem } from '../BankUiProvider';
import type { TransactionType } from '../types';

const TYPES = new Set<TransactionType>([
  'DEPOSIT',
  'WITHDRAWAL',
  'TRANSFER_IN',
  'TRANSFER_OUT',
]);

const TYPE_LABELS: Record<TransactionType, string> = {
  DEPOSIT: 'Dépôt',
  WITHDRAWAL: 'Retrait',
  TRANSFER_IN: 'Transfert entrant',
  TRANSFER_OUT: 'Transfert sortant',
};

type ParsedPreview = {
  items: ImportTransactionItem[];
  parseErrors: string[];
};

function parseImportJson(raw: string): ParsedPreview {
  const trimmed = raw.trim();
  if (!trimmed) return { items: [], parseErrors: [] };

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    return { items: [], parseErrors: ['JSON invalide'] };
  }

  if (!Array.isArray(data)) {
    return { items: [], parseErrors: ['Le JSON doit être un tableau'] };
  }

  const items: ImportTransactionItem[] = [];
  const parseErrors: string[] = [];

  data.forEach((row, index) => {
    if (!row || typeof row !== 'object') {
      parseErrors.push(`Ligne ${index + 1} : objet attendu`);
      return;
    }
    const record = row as Record<string, unknown>;
    const date = typeof record.date === 'string' ? record.date.trim() : '';
    const type = typeof record.type === 'string' ? record.type : '';
    const name = typeof record.name === 'string' ? record.name.trim() : '';
    const description =
      record.description == null
        ? null
        : typeof record.description === 'string'
          ? record.description
          : null;
    const amount = typeof record.amount === 'number' ? record.amount : Number(record.amount);

    if (!date) {
      parseErrors.push(`Ligne ${index + 1} : date manquante`);
      return;
    }
    if (!TYPES.has(type as TransactionType)) {
      parseErrors.push(`Ligne ${index + 1} : type invalide`);
      return;
    }
    if (!name) {
      parseErrors.push(`Ligne ${index + 1} : nom manquant`);
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      parseErrors.push(`Ligne ${index + 1} : montant invalide`);
      return;
    }

    items.push({
      date,
      type: type as TransactionType,
      name,
      description,
      amount,
    });
  });

  return { items, parseErrors };
}

type ImportTransactionsModalProps = {
  opened: boolean;
  onClose: () => void;
  onImported: () => Promise<void>;
};

export function ImportTransactionsModal({
  opened,
  onClose,
  onImported,
}: ImportTransactionsModalProps) {
  const { actions } = useBankUi();
  const [raw, setRaw] = useState('');
  const [pending, setPending] = useState(false);

  const preview = useMemo(() => parseImportJson(raw), [raw]);

  const reset = () => {
    setRaw('');
    setPending(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = async (file: File | null) => {
    if (!file) return;
    const text = await file.text();
    setRaw(text);
  };

  const handleImport = async () => {
    if (preview.items.length === 0) return;
    setPending(true);
    try {
      const result = await actions.importTransactions({ items: preview.items });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Import impossible',
          message: result.error ?? 'Erreur inconnue',
          color: 'danger',
        });
        return;
      }

      const { created, skipped, errors } = result.data;
      notifications.show({
        title: 'Import terminé',
        message: `${created} créée(s), ${skipped} ignorée(s)${
          errors.length ? `, ${errors.length} erreur(s) de date` : ''
        }`,
        color: 'moss',
      });
      await onImported();
      handleClose();
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title="Importer des transactions"
      size="lg"
      yOffset={60}
    >
      <Stack gap="md">
        <Text size="sm" c="dimmed">
          Collez un tableau JSON ou chargez un fichier. Les dates sont en calendrier RP
          (ex. 10/08/1890 18:16). Les doublons déjà présents sont ignorés.
        </Text>

        <Group justify="space-between" align="center">
          <FileButton onChange={handleFile} accept="application/json,.json">
            {(props) => (
              <Button
                {...props}
                variant="light"
                leftSection={<IconUpload size={16} />}
                size="sm"
              >
                Charger un fichier JSON
              </Button>
            )}
          </FileButton>
          {preview.items.length > 0 && (
            <Group gap="xs">
              <Badge variant="light" color="moss">
                {preview.items.length} valide(s)
              </Badge>
              {preview.parseErrors.length > 0 && (
                <Badge variant="light" color="danger">
                  {preview.parseErrors.length} erreur(s)
                </Badge>
              )}
            </Group>
          )}
        </Group>

        <Textarea
          placeholder='[{ "date": "10/08/1890 18:16", "type": "TRANSFER_OUT", "name": "…", "description": "…", "amount": 2 }]'
          value={raw}
          onChange={(e) => setRaw(e.currentTarget.value)}
          minRows={8}
          autosize
          maxRows={16}
          styles={{ input: { fontFamily: 'var(--mantine-font-family-monospace, monospace)' } }}
        />

        {preview.parseErrors.length > 0 && (
          <Stack gap={4}>
            {preview.parseErrors.slice(0, 5).map((error) => (
              <Text key={error} size="xs" c="danger">
                {error}
              </Text>
            ))}
            {preview.parseErrors.length > 5 && (
              <Text size="xs" c="dimmed">
                +{preview.parseErrors.length - 5} autre(s)…
              </Text>
            )}
          </Stack>
        )}

        {preview.items.length > 0 && (
          <Table.ScrollContainer minWidth={480} maxHeight={220}>
            <Table striped highlightOnHover withTableBorder horizontalSpacing="sm" verticalSpacing={6}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Date</Table.Th>
                  <Table.Th>Type</Table.Th>
                  <Table.Th>Nom</Table.Th>
                  <Table.Th ta="right">Montant</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {preview.items.slice(0, 10).map((item, index) => (
                  <Table.Tr key={`${item.date}-${item.name}-${index}`}>
                    <Table.Td>
                      <Text size="xs">{item.date}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">{TYPE_LABELS[item.type]}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" lineClamp={1}>
                        {item.name}
                      </Text>
                    </Table.Td>
                    <Table.Td ta="right">
                      <Text size="xs" fw={600}>
                        {item.amount.toFixed(2)} $
                      </Text>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </Table.ScrollContainer>
        )}

        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose} disabled={pending}>
            Annuler
          </Button>
          <Button
            leftSection={<IconFileImport size={16} />}
            onClick={() => void handleImport()}
            loading={pending}
            disabled={preview.items.length === 0}
          >
            Importer {preview.items.length > 0 ? `(${preview.items.length})` : ''}
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}
