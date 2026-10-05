/** Single permission: whoever can access the library has every right on it. */
export const mediaActionAuth = {
  feature: 'media' as const,
  permission: { resource: 'media' as const, action: 'access' },
};
