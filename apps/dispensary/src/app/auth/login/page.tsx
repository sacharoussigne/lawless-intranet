import { redirect } from 'next/navigation';
import { getAuthLoginRedirectUrl } from '@/lib/authSession';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  redirect(getAuthLoginRedirectUrl(callbackUrl));
}
