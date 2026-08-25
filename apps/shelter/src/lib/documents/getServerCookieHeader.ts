export async function getServerCookieHeader(): Promise<string | null> {
  const { headers } = await import('next/headers');
  return (await headers()).get('cookie');
}
