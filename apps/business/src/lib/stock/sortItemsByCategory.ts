type SortableItem = {
  name: string;
  order: number;
  category: { order?: number } | null;
};

function compareByOrderThenName(
  orderA: number | undefined,
  orderB: number | undefined,
  nameA: string,
  nameB: string,
): number {
  if (orderA !== undefined && orderB !== undefined && orderA !== orderB) {
    return orderA - orderB;
  }
  if (orderA !== undefined && orderB === undefined) return -1;
  if (orderA === undefined && orderB !== undefined) return 1;
  return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' });
}

export function sortItems<T extends SortableItem>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const categoryOrderA = a.category?.order ?? 0;
    const categoryOrderB = b.category?.order ?? 0;
    if (categoryOrderA !== categoryOrderB) {
      return categoryOrderA - categoryOrderB;
    }
    return compareByOrderThenName(a.order, b.order, a.name, b.name);
  });
}
