const tabClientIds = new Map<string, string>();

function createClientId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateRealtimeClientId(storageKey = 'default'): string {
  // globalThis lookup keeps this module type-safe for non-DOM (server) consumers.
  if (typeof (globalThis as { window?: unknown }).window === 'undefined') {
    return '';
  }

  const existing = tabClientIds.get(storageKey);
  if (existing) {
    return existing;
  }

  const created = createClientId(storageKey);
  tabClientIds.set(storageKey, created);
  return created;
}
