import { getISOWeek } from 'date-fns';
import type { RpCalendar } from '@/lib/rpCalendar';

export const PAYROLL_DAYS = [
  'lundi',
  'mardi',
  'mercredi',
  'jeudi',
  'vendredi',
  'samedi',
  'dimanche',
] as const;

export type PayrollDay = (typeof PAYROLL_DAYS)[number];

export const CAISSE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'X', label: 'X' },
] as const;

export const PRESENCE_OPTIONS = [
  { value: '', label: '—' },
  { value: 'P', label: 'P' },
] as const;

export const BANDAGE_EXPORT_DEPOSIT_MOTIF = "Caisse d'exportation Bandage";

export function wireTransferDescription(weekStart: Date, weekEnd: Date, rp: RpCalendar): string {
  return `Salaire ${rp.formatRpDate(weekStart)} au ${rp.formatRpDate(weekEnd)} - N°${getISOWeek(weekStart)}`;
}
