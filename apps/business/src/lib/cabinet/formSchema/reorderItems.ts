export function reorderByOrder<T extends { id: string; order: number }>(
  items: T[],
  itemId: string,
  direction: 'up' | 'down',
): T[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((i) => i.id === itemId);
  if (index === -1) return items;

  const swapWith = direction === 'up' ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= sorted.length) return items;

  const next = [...sorted];
  [next[index], next[swapWith]] = [next[swapWith], next[index]];
  return next.map((item, i) => ({ ...item, order: i }));
}
