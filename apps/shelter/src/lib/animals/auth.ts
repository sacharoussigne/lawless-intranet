export const animalsAccessAuth = {
  permission: { resource: 'animals' as const, action: 'access' },
};

export const animalsCreateAuth = {
  permission: { resource: 'animals' as const, action: 'create' },
};

export const animalsUpdateAuth = {
  permission: { resource: 'animals' as const, action: 'update' },
};

export const animalsUpdateCoreAuth = {
  permission: { resource: 'animals' as const, action: 'updateCore' },
};

export const animalsDeleteAuth = {
  permission: { resource: 'animals' as const, action: 'delete' },
};
