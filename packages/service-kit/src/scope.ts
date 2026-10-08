export function scopeWhere(scopeType: string, scopeId: string) {
  return { scopeType, scopeId };
}

export function scopeKey(scopeType: string, scopeId: string) {
  return `${scopeType}:${scopeId}`;
}
