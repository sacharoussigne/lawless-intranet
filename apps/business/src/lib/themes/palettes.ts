import type { ThemePalette } from '@lawless-intranet/host-kit/theme';
import {
  amberPalette,
  clayPalette,
  dangerPalette,
  denimPalette,
  leatherPalette,
  mossPalette,
  sagePalette,
  slatePalette,
  winePalette,
} from '@/lib/design-tokens';

/** Palettes with soft tints (`--disp-<name>-soft*`), shared by every theme. */
export const DISP_SOFT_PALETTES: Record<string, ThemePalette> = {
  sage: sagePalette,
  leather: leatherPalette,
  danger: dangerPalette,
  slate: slatePalette,
  wine: winePalette,
  clay: clayPalette,
  amber: amberPalette,
  moss: mossPalette,
  denim: denimPalette,
};
