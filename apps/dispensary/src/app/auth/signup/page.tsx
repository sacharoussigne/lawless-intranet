import { redirect } from 'next/navigation';
import { getSignupUrl } from '@lawless-intranet/auth-client/browser';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  const callbackUrl =
    params.callbackUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  redirect(getSignupUrl(callbackUrl));
}
