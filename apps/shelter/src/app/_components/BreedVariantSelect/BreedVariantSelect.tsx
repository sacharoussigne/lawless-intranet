'use client';

import { useMemo, useState, useTransition } from 'react';
import { Select } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { createVariant } from '@/app/_actions/species';
import { actionErrorMessage } from '@/app/(loggedIn)/s/[shelterSlug]/employee/animals/types';

const CREATE_VALUE_PREFIX = '__create__:';

export type BreedVariantOption = {
  id: string;
  label: string;
};

type BreedVariantSelectProps = {
  shelterSlug: string;
  breedId: string | null;
  variants: BreedVariantOption[];
  onVariantsChange: (next: BreedVariantOption[]) => void;
  value: string | null;
  onChange: (value: string | null) => void;
  disabled?: boolean;
  label?: string;
  clearable?: boolean;
};

function normalizeLabel(label: string): string {
  return label.trim().toLocaleLowerCase('fr');
}

export function BreedVariantSelect({
  shelterSlug,
  breedId,
  variants,
  onVariantsChange,
  value,
  onChange,
  disabled = false,
  label = 'Variante',
  clearable = true,
}: BreedVariantSelectProps) {
  const [search, setSearch] = useState('');
  const [pending, startTransition] = useTransition();

  const trimmedSearch = search.trim();
  const exactMatch = useMemo(
    () =>
      trimmedSearch.length > 0 &&
      variants.some((variant) => normalizeLabel(variant.label) === normalizeLabel(trimmedSearch)),
    [trimmedSearch, variants],
  );

  const data = useMemo(() => {
    const options = variants.map((variant) => ({
      value: variant.id,
      label: variant.label,
    }));
    if (breedId && trimmedSearch && !exactMatch) {
      options.push({
        value: `${CREATE_VALUE_PREFIX}${trimmedSearch}`,
        label: `Ajouter « ${trimmedSearch} »`,
      });
    }
    return options;
  }, [breedId, exactMatch, trimmedSearch, variants]);

  const createFromLabel = (rawLabel: string) => {
    if (!breedId) return;
    const labelToCreate = rawLabel.trim();
    if (!labelToCreate) return;

    startTransition(async () => {
      const result = await createVariant(shelterSlug, {
        breedId,
        label: labelToCreate,
      });

      if (result.status === 201 && 'data' in result && result.data) {
        const created = {
          id: result.data.id,
          label: result.data.label,
        };
        onVariantsChange([...variants, created]);
        onChange(created.id);
        setSearch(created.label);
        return;
      }

      if (result.status === 409) {
        const existing = variants.find(
          (variant) => normalizeLabel(variant.label) === normalizeLabel(labelToCreate),
        );
        if (existing) {
          onChange(existing.id);
          setSearch(existing.label);
        }
        notifications.show({
          title: 'Variante existante',
          message: actionErrorMessage(result, 'Cette variante existe déjà'),
          color: 'terracotta',
        });
        return;
      }

      notifications.show({
        title: 'Erreur',
        message: actionErrorMessage(result, 'Impossible d’ajouter la variante'),
        color: 'danger',
      });
    });
  };

  return (
    <Select
      label={label}
      data={data}
      value={value}
      onChange={(next) => {
        if (next?.startsWith(CREATE_VALUE_PREFIX)) {
          createFromLabel(next.slice(CREATE_VALUE_PREFIX.length));
          return;
        }
        onChange(next);
      }}
      searchable
      searchValue={search}
      onSearchChange={setSearch}
      clearable={clearable}
      disabled={disabled || pending || !breedId}
      nothingFoundMessage={
        breedId && trimmedSearch && !exactMatch
          ? `Ajouter « ${trimmedSearch} »`
          : 'Aucune variante'
      }
      placeholder={!breedId ? 'Choisir une race d’abord' : undefined}
    />
  );
}
