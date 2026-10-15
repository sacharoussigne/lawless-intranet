import { getMyTheme } from '@/app/_actions/uiTheme';

export const dynamic = 'force-dynamic';

/** Theme saved in the account, read by the header on every page load (GET: no server action queue). */
export async function GET() {
  const result = await getMyTheme();
  return Response.json(result, {
    status: result.status,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
