export const speciesActionAuth = {
  permission: { resource: 'species' as const, action: 'manage' },
};

/** Create a breed variant from species admin or animal create/edit flows. */
export const createVariantActionAuth = {
  anyOfPermissions: [
    { resource: 'species' as const, action: 'manage' },
    { resource: 'animals' as const, action: 'create' },
    { resource: 'animals' as const, action: 'updateCore' },
  ],
  anyOfPermissionsMessage: 'Permission refusée pour ajouter une variante',
};
