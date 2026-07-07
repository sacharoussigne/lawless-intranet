import { z } from 'zod';
import type { CabinetDisplaySettings } from './types';

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Couleur hex invalide');

const nullableHexColorSchema = z.union([hexColorSchema, z.null()]);

const labelColorKeySchema = z.enum(['text', 'textarea', 'date', 'select', 'system']);

export const cabinetDisplaySettingsSchema = z.object({
  labelColors: z
    .record(labelColorKeySchema, nullableHexColorSchema)
    .optional(),
  fieldLabelColors: z.record(z.string().min(1), nullableHexColorSchema).optional(),
});

export function parseCabinetDisplaySettings(raw: unknown): CabinetDisplaySettings {
  if (raw == null || (typeof raw === 'object' && Object.keys(raw as object).length === 0)) {
    return {};
  }

  const parsed = cabinetDisplaySettingsSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }

  return {};
}

export function createDefaultDisplaySettings(): CabinetDisplaySettings {
  return {};
}
