export const DISCORD_PROVIDER_ID = 'discord';

export function getTrustedOrigins(): string[] {
  const origins = [
    process.env.BETTER_AUTH_URL,
    process.env.DISPENSARY_URL,
    'http://localhost:3001',
    'http://localhost:3000',
    'http://auth.localhost:3001',
    'http://dispensary.localhost:3000',
  ].filter(Boolean) as string[];

  return [...new Set(origins)];
}

export function getCookieDomain(): string {
  return process.env.AUTH_COOKIE_DOMAIN ?? '.localhost';
}
