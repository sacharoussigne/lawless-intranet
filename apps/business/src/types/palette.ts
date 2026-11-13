/** Entity found by the command palette (« @george »). */
/** `management`: an entity of the management pages, opened in its edit window. */
export type PaletteEntityType = 'order' | 'patient' | 'correspondent' | 'letter' | 'item' | 'management';

export type PaletteEntityHit = {
  type: PaletteEntityType;
  id: string;
  label: string;
  /** Second line: customer and status, cabinet, serial and date… */
  detail: string;
  href: string;
};
