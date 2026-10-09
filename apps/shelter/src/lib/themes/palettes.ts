import type { ThemePalette } from '@lawless-intranet/host-kit/theme';
import {
  dangerPalette,
  leatherPalette,
  mossPalette,
  sageDustPalette,
  slatePalette,
  terracottaPalette,
} from '@/lib/design-tokens';

/** Palettes with soft tints (`--shelter-<name>-soft*`), shared by every theme. */
export const SHELTER_SOFT_PALETTES: Record<string, ThemePalette> = {
  terracotta: terracottaPalette,
  sageDust: sageDustPalette,
  danger: dangerPalette,
  slate: slatePalette,
  leather: leatherPalette,
  moss: mossPalette,
};
