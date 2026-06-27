import type { FormFieldType } from '@/lib/cabinet/formSchema';

export type CabinetLabelColorKey = FormFieldType | 'system';

export type CabinetDisplaySettings = {
  labelColors?: Partial<Record<CabinetLabelColorKey, string | null>>;
  /** Phase 2: per-field overrides keyed by field.id */
  fieldLabelColors?: Record<string, string | null>;
};
