export function getTrustedOrigins(): string[] {
  const origins = [
    process.env.DISPENSARY_URL,
    'http://localhost:3000',
    'http://localhost:3002',
    'http://dispensary.localhost:3000',
    'http://documents.localhost:3002',
  ].filter(Boolean) as string[];

  return [...new Set(origins)];
}
