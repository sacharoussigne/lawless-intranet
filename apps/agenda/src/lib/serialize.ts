function isDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function serializeDates<T>(value: T): T {
  if (value === null || value === undefined) {
    return value;
  }

  if (isDate(value)) {
    return value.toISOString() as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => serializeDates(item)) as T;
  }

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serializeDates(nested);
    }
    return result as T;
  }

  return value;
}
