export type FormEntityType = 'patient' | 'careEpisode' | 'consultation';

export type FormFieldType = 'text' | 'date' | 'textarea' | 'select';

export type SelectOption = {
  id: string;
  label: string;
};

export type ConditionalBranch = {
  optionId: string;
  fields: FormField[];
};

export type FormField = {
  id: string;
  type: FormFieldType;
  label: string;
  required: boolean;
  order: number;
  placeholder?: string;
  defaultValue?: string;
  /** When false, the field value cannot be changed when filling the form. Omitted = editable. */
  editable?: boolean;
  options?: SelectOption[];
  /** When true, multiple options can be selected (stored as JSON array of option ids). */
  multiple?: boolean;
  conditionalBranches?: ConditionalBranch[];
};

export type FormCategory = {
  id: string;
  name: string;
  isSystem: boolean;
  systemKey?: 'patient_identity' | 'care_episode_general' | 'consultation_general';
  order: number;
  fields: FormField[];
};

export type FormEntitySchema = {
  categories: FormCategory[];
};

export type CabinetFormSchemas = {
  patient: FormEntitySchema;
  careEpisode: FormEntitySchema;
  consultation: FormEntitySchema;
};

export type CustomValues = Record<string, string | null>;

export const SYSTEM_CATEGORY_IDS = {
  patientIdentity: 'system-patient-identity',
  careEpisodeGeneral: 'system-care-episode-general',
  consultationGeneral: 'system-consultation-general',
} as const;
