'use client';

import { Select } from '@mantine/core';
import { useOrderResponsibleOptions } from '../hooks/useOrdersQueries';

type OrderResponsibleSelectProps = {
  value: string | null;
  onChange: (userId: string | null) => void;
  disabled?: boolean;
};

/** Member of the business in charge of the order (optional). */
export function OrderResponsibleSelect({ value, onChange, disabled }: OrderResponsibleSelectProps) {
  const { data: options = [], isLoading } = useOrderResponsibleOptions();
  const data = options.map((option) => ({ value: option.userId, label: option.name }));
  // A former member stays visible until someone changes it.
  if (value && !options.some((option) => option.userId === value) && !isLoading) {
    data.unshift({ value, label: 'Ancien membre' });
  }

  return (
    <Select
      label="Responsable"
      placeholder={isLoading ? 'Chargement…' : 'Aucun'}
      data={data}
      value={value}
      onChange={onChange}
      searchable
      clearable
      nothingFoundMessage="Aucun membre"
      disabled={disabled}
    />
  );
}
