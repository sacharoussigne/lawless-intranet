import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getSignupUrl } from '@lawless-intranet/auth-client/browser';
import { appOriginFromHeaders } from '@/lib/authSession';

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const params = await searchParams;
  // Back to the host the user came from (dispensaire.*, gs.*, business.*…).
  const callbackUrl = params.callbackUrl ?? appOriginFromHeaders(await headers());
  redirect(getSignupUrl(callbackUrl));
}
