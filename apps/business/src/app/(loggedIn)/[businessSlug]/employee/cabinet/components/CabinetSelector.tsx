'use client';

import { Select } from '@mantine/core';
import type { CabinetSummaryDTO } from '@/types/cabinet';

interface CabinetSelectorProps {
  cabinets: CabinetSummaryDTO[];
  value: string | null;
  onChange: (cabinetId: string) => void;
}

export function CabinetSelector({ cabinets, value, onChange }: CabinetSelectorProps) {
  if (cabinets.length <= 1) {
    return null;
  }

  return (
    <Select
      data={cabinets.map((c) => ({ value: c.id, label: c.name }))}
      value={value}
      onChange={(v) => v && onChange(v)}
      w={260}
    />
  );
}
