export function getTrustedOrigins(): string[] {
  const origins = [
    process.env.DISPENSARY_URL,
    process.env.SHELTER_URL,
    'http://localhost:3000',
    'http://localhost:3006',
    'http://dispensary.localhost:3000',
    'http://shelter.localhost:3006',
  ].filter(Boolean) as string[];

  return [...new Set(origins)];
}
