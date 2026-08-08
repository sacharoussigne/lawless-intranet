export function getTrustedOrigins(): string[] {
  const origins = [
    process.env.DISPENSARY_URL,
    'http://localhost:3000',
    'http://dispensary.localhost:3000',
  ].filter(Boolean) as string[];

  return [...new Set(origins)];
}
