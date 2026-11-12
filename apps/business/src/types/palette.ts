/** Entity found by the command palette (« @george »). */
export type PaletteEntityType = 'order' | 'patient' | 'correspondent' | 'letter' | 'item';

export type PaletteEntityHit = {
  type: PaletteEntityType;
  id: string;
  label: string;
  /** Second line: customer and status, cabinet, serial and date… */
  detail: string;
  href: string;
};
