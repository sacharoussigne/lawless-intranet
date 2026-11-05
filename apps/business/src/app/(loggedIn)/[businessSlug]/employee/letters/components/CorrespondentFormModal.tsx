'use client';

import { useState } from 'react';
import { Button, Group, TextInput, Textarea } from '@mantine/core';
import { IconUser } from '@tabler/icons-react';
import { noAutofillProps } from '@lawless-intranet/host-kit/no-autofill';
import { AppModal, AppModalFooter } from '@/app/_components/AppModal/AppModal';
import { DeleteConfirmPopover } from '@/app/_components/DeleteConfirmPopover/DeleteConfirmPopover';
import {
  createLetterCorrespondent,
  deleteLetterCorrespondent,
  updateLetterCorrespondent,
} from '@/app/_actions/letters/correspondents';
import type { LetterCorrespondentDTO } from '@/types/letters';
import { useLetterBoxMutation } from '../hooks/useLettersQueries';

/** Add a correspondent, or rename / annotate / delete one. Remounted (key) for each opening. */
export function CorrespondentFormModal({
  opened,
  onClose,
  boxId,
  correspondent,
  initialName,
  onSaved,
  onDeleted,
}: {
  opened: boolean;
  onClose: () => void;
  boxId: string;
  correspondent: LetterCorrespondentDTO | null;
  initialName: string;
  onSaved: (id: string) => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState(correspondent?.name ?? initialName);
  const [note, setNote] = useState(correspondent?.note ?? '');
  const save = useLetterBoxMutation(
    boxId,
    (slug, vars: { name: string; note: string | null }, meta) =>
      correspondent
        ? updateLetterCorrespondent(slug, { id: correspondent.id, ...vars }, meta)
        : createLetterCorrespondent(slug, { boxId, ...vars }, meta),
    { success: correspondent ? 'Correspondant modifié' : 'Correspondant ajouté', error: 'Enregistrement impossible' },
  );
  const remove = useLetterBoxMutation(
    boxId,
    (slug, id: string, meta) => deleteLetterCorrespondent(slug, { id }, meta),
    { success: 'Correspondant supprimé', error: 'Suppression impossible' },
  );

  const submit = () =>
    void save
      .mutateAsync({ name: name.trim(), note: note.trim() || null })
      .then((data) => {
        onSaved((data as { id: string }).id);
        onClose();
      })
      .catch(() => undefined);

  return (
    <AppModal
      opened={opened}
      onClose={onClose}
      title={correspondent ? 'Modifier le correspondant' : 'Nouveau correspondant'}
      icon={IconUser}
      footer={
        <AppModalFooter align={correspondent ? 'space-between' : 'flex-end'}>
          {correspondent ? (
            <DeleteConfirmPopover
              title="Supprimer le correspondant ?"
              message={
                correspondent.letterCount > 0
                  ? 'Il a encore des lettres : supprimez-les ou déplacez-les d’abord.'
                  : `${correspondent.name} sera retiré de la boîte.`
              }
              onConfirm={async () => {
                await remove.mutateAsync(correspondent.id).then(onDeleted, () => undefined);
              }}
            >
              <Button variant="subtle" color="danger" disabled={correspondent.letterCount > 0}>
                Supprimer
              </Button>
            </DeleteConfirmPopover>
          ) : null}
          <Group gap="xs">
            <Button variant="subtle" color="slate" onClick={onClose}>
              Annuler
            </Button>
            <Button color="sage" loading={save.isPending} disabled={!name.trim()} onClick={submit}>
              {correspondent ? 'Enregistrer' : 'Ajouter'}
            </Button>
          </Group>
        </AppModalFooter>
      }
    >
      <TextInput
        label="Nom"
        placeholder="Ex. George Miller"
        data-autofocus
        value={name}
        onChange={(event) => setName(event.currentTarget.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' && name.trim()) submit();
        }}
        {...noAutofillProps}
      />
      <Textarea
        label="Note"
        description="Facultatif : qui c’est, où il habite…"
        autosize
        minRows={2}
        value={note}
        onChange={(event) => setNote(event.currentTarget.value)}
        {...noAutofillProps}
      />
    </AppModal>
  );
}
