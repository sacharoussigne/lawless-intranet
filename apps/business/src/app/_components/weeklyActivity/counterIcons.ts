import {
  IconBread,
  IconDroplet,
  IconGlassFull,
  IconMilk,
  IconShield,
  IconUserPlus,
} from '@tabler/icons-react';
import type { WeeklyCounterIcon } from '@/lib/businessTypes';

/** Tabler icon of each weekly activity counter icon (lib/businessTypes). */
export const WEEKLY_COUNTER_ICONS: Record<WeeklyCounterIcon, typeof IconUserPlus> = {
  patients: IconUserPlus,
  sheriffs: IconShield,
  infusions: IconDroplet,
  poppyMilk: IconMilk,
  food: IconBread,
  drink: IconGlassFull,
};
