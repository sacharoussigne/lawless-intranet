export function tenantWhere(businessId: string) {
  return { businessId } as const;
}
