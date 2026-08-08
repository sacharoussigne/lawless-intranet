import type { InventoryActionResult } from '../types';

export function unwrapActionResult<T>(result: InventoryActionResult<T>): T {
  if (result && 'data' in result && result.data !== undefined) {
    return result.data;
  }
  throw new Error(result.error || 'Erreur');
}
