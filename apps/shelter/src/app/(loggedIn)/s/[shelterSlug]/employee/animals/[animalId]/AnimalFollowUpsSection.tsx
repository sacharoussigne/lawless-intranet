'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import {
  Badge,
  Button,
  Group,
  Modal,
  Select,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconPlus } from '@tabler/icons-react';
import { useRouter } from 'next/navigation';
import { listCaseManagerOptions } from '@/app/_actions/animals';
import { createAnimalFollowUp, listAnimalFollowUps } from '@/app/_actions/followUps';
import { RpDateInput } from '@/app/_components/RpDateInput/RpDateInput';
import { useTenantRoutes } from '@/app/_contexts/PermissionsContext';
import { authClient } from '@lawless-intranet/auth-client/browser';
import {
  FOLLOW_UP_STATUS_BADGE_COLORS,
  FOLLOW_UP_STATUS_LABELS,
  isFollowUpClosed,
} from '@/lib/animals/followUpLabels';
import { formatRpDate } from '@/lib/rpCalendar';
import pageClasses from '../AnimalsPage.module.scss';
import {
  actionErrorMessage,
  parseIsoDateOnly,
  toIsoDateOnly,
  type CaseManagerOptionDTO,
} from '../types';
import classes from './FollowUps.module.scss';
import type { FollowUpDTO } from './followUpTypes';

function compareFollowUpsRecentFirst(a: FollowUpDTO, b: FollowUpDTO): number {
  if (a.date !== b.date) return b.date.localeCompare(a.date);
  return b.createdAt.localeCompare(a.createdAt);
}

export function AnimalFollowUpsSection({
  shelterSlug,
  animalId,
  defaultRecipientName,
  defaultConductedByUserId,
  canUpdate,
}: {
  shelterSlug: string;
  animalId: string;
  defaultRecipientName: string | null;
  defaultConductedByUserId: string;
  canUpdate: boolean;
}) {
  const router = useRouter();
  const t = useTenantRoutes();
  const [followUps, setFollowUps] = useState<FollowUpDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [managers, setManagers] = useState<CaseManagerOptionDTO[]>([]);

  const [date, setDate] = useState<Date | null>(new Date());
  const [motif, setMotif] = useState('');
  const [recipientName, setRecipientName] = useState(defaultRecipientName?.trim() ?? '');
  const [conductedByUserId, setConductedByUserId] = useState<string | null>(
    defaultConductedByUserId,
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [followRes, managersRes, session] = await Promise.all([
          listAnimalFollowUps(shelterSlug, animalId),
          listCaseManagerOptions(shelterSlug),
          authClient.getSession(),
        ]);
        if (cancelled) return;
        if (followRes.status < 400 && 'data' in followRes && followRes.data) {
          setFollowUps(followRes.data as FollowUpDTO[]);
        }
        if (managersRes.status < 400 && 'data' in managersRes && managersRes.data) {
          setManagers(managersRes.data);
        }
        const sessionUserId = session?.data?.user?.id;
        if (sessionUserId) {
          setConductedByUserId(sessionUserId);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          notifications.show({
            title: 'Erreur',
            message: 'Impossible de charger les suivis',
            color: 'danger',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shelterSlug, animalId]);

  const managerOptions = useMemo(() => {
    const options = managers.map((m) => ({ value: m.userId, label: m.name }));
    if (conductedByUserId && !options.some((o) => o.value === conductedByUserId)) {
      options.push({ value: conductedByUserId, label: conductedByUserId });
    }
    return options;
  }, [managers, conductedByUserId]);

  const sortedFollowUps = useMemo(
    () => followUps.slice().sort(compareFollowUpsRecentFirst),
    [followUps],
  );

  const openCreate = () => {
    setMotif('');
    setDate(new Date());
    setRecipientName(defaultRecipientName?.trim() ?? '');
    setCreateOpen(true);
  };

  const openFollowUp = (followUpId: string) => {
    router.push(t.employee.animalFollowUp(animalId, followUpId));
  };

  const handleCreate = () => {
    if (!date || !motif.trim() || !recipientName.trim() || !conductedByUserId) {
      notifications.show({
        title: 'Erreur',
        message: 'Renseignez tous les champs obligatoires',
        color: 'danger',
      });
      return;
    }
    startTransition(async () => {
      const result = await createAnimalFollowUp(shelterSlug, {
        animalId,
        date: toIsoDateOnly(date),
        motif: motif.trim(),
        recipientName: recipientName.trim(),
        conductedByUserId,
      });
      if (result.status >= 400 || !('data' in result) || !result.data) {
        notifications.show({
          title: 'Erreur',
          message: actionErrorMessage(result, 'Impossible de créer le suivi'),
          color: 'danger',
        });
        return;
      }
      const created = result.data as FollowUpDTO;
      notifications.show({
        title: 'Suivi créé',
        message: created.motif,
        color: 'terracotta',
      });
      router.push(t.employee.animalFollowUp(animalId, created.id));
    });
  };

  return (
    <section>
      <Group justify="space-between" align="center" mb="sm" wrap="wrap">
        <Text className={pageClasses.sectionTitle} mb={0}>
          Suivis ({loading ? '…' : sortedFollowUps.length})
        </Text>
        {canUpdate ? (
          <Button
            type="button"
            color="terracotta"
            variant="light"
            leftSection={<IconPlus size={16} />}
            onClick={openCreate}
          >
            Nouveau suivi
          </Button>
        ) : null}
      </Group>

      <Modal
        opened={createOpen}
        onClose={() => {
          if (!pending) setCreateOpen(false);
        }}
        title="Nouveau suivi"
        size="lg"
        centered
      >
        <Stack gap="md">
          <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
            <RpDateInput
              label="Date"
              required
              value={date}
              onChange={setDate}
              disabled={pending}
            />
            <TextInput
              label="Destinataire"
              required
              value={recipientName}
              onChange={(e) => setRecipientName(e.currentTarget.value)}
              disabled={pending}
            />
          </SimpleGrid>
          <TextInput
            label="Motif"
            required
            value={motif}
            onChange={(e) => setMotif(e.currentTarget.value)}
            disabled={pending}
            placeholder="Ex. Contrôle post-adoption"
          />
          <Select
            label="Conduit par"
            required
            data={managerOptions}
            value={conductedByUserId}
            onChange={setConductedByUserId}
            searchable
            disabled={pending}
          />
          <Group justify="flex-end" gap="sm">
            <Button
              type="button"
              variant="light"
              color="terracotta"
              onClick={() => setCreateOpen(false)}
              disabled={pending}
            >
              Annuler
            </Button>
            <Button type="button" color="terracotta" loading={pending} onClick={handleCreate}>
              Créer
            </Button>
          </Group>
        </Stack>
      </Modal>

      {loading ? (
        <Text size="sm" c="dimmed">
          Chargement des suivis…
        </Text>
      ) : sortedFollowUps.length === 0 ? (
        <Text size="sm" c="dimmed">
          Aucun suivi pour cet animal.
        </Text>
      ) : (
        <Stack gap="sm">
          {sortedFollowUps.map((followUp) => (
            <button
              key={followUp.id}
              type="button"
              className={classes.followUpCard}
              onClick={() => openFollowUp(followUp.id)}
            >
              <div className={classes.followUpCardTop}>
                <Text fw={700}>{followUp.motif}</Text>
                <Badge
                  size="md"
                  radius="sm"
                  color={FOLLOW_UP_STATUS_BADGE_COLORS[followUp.status].color}
                  variant={FOLLOW_UP_STATUS_BADGE_COLORS[followUp.status].variant}
                >
                  {FOLLOW_UP_STATUS_LABELS[followUp.status]}
                </Badge>
              </div>
              <Text className={classes.followUpMeta}>
                {formatRpDate(parseIsoDateOnly(followUp.date), 'dd/MM/yyyy')}
                {' · '}
                Destinataire : {followUp.recipientName}
                {' · '}
                Conduit par {followUp.conductedByName}
                {followUp.messages.length > 0
                  ? ` · ${followUp.messages.length} lettre${followUp.messages.length > 1 ? 's' : ''}`
                  : ''}
              </Text>
              {isFollowUpClosed(followUp.status) && followUp.closureNote ? (
                <Text className={classes.followUpClosure} size="sm">
                  Clôture : {followUp.closureNote}
                </Text>
              ) : null}
            </button>
          ))}
        </Stack>
      )}
    </section>
  );
}
