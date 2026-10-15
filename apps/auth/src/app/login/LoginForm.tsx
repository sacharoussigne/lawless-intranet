'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { AuthPageShell } from '@/app/_components/AuthPageShell';
import { authClient, signInWithDiscord } from '@/lib/client';
import { getSafeCallbackUrl } from '@/lib/callbackUrl';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  // Discord is the usual way in: the email form stays folded until asked for.
  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(undefined);
    setIsLoading(true);

    const response = await authClient.signIn.email({
      email: email.trim(),
      password: password.trim(),
      callbackURL: callbackUrl,
    });

    setIsLoading(false);

    if (response.error) {
      setAuthError(response.error.message);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  };

  return (
    <AuthPageShell
      title="Connexion"
      subtitle={
        <>
          Pas encore de compte ?{' '}
          <Link
            href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-blue-600 hover:underline"
          >
            Créer un compte
          </Link>
        </>
      }
    >
      <button
        type="button"
        onClick={() => signInWithDiscord(callbackUrl)}
        className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#5865F2] px-4 py-3 text-base font-medium sm:py-2.5 sm:text-sm text-white hover:bg-[#4752C4]"
      >
        Continuer avec Discord
      </button>
      <p className="mt-2 text-center text-xs text-zinc-500">
        Vous serez redirigé vers discord.com pour autoriser l&apos;accès. Nous ne voyons jamais votre
        mot de passe Discord.
      </p>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-zinc-200" />
        <span className="text-xs text-zinc-500">Ou</span>
        <div className="h-px flex-1 bg-zinc-200" />
      </div>

      {showEmailForm ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              autoComplete="username"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
              placeholder="vous@exemple.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              autoComplete="current-password"
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          {authError ? <p className="text-sm text-red-600">{authError}</p> : null}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-zinc-900 px-4 py-3 text-base font-medium sm:py-2.5 sm:text-sm text-white hover:bg-zinc-800 disabled:opacity-60"
          >
            {isLoading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setShowEmailForm(true)}
          className="w-full text-center text-sm text-blue-600 hover:underline"
        >
          Se connecter avec un email
        </button>
      )}
    </AuthPageShell>
  );
}
