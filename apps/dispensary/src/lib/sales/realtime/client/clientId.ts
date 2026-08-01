let tabClientId: string | null = null;

function createClientId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `sales-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function getOrCreateSalesClientId(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  if (!tabClientId) {
    tabClientId = createClientId();
  }

  return tabClientId;
}
