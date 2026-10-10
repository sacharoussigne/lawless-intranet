'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/client';
import { getSafeCallbackUrl } from '@/lib/callbackUrl';

export default function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = getSafeCallbackUrl(searchParams.get('callbackUrl'));
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setAuthError(undefined);
    setIsLoading(true);

    const response = await authClient.signUp.email({
      email: email.trim(),
      password: password.trim(),
      name: username.trim(),
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
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <h1 className="text-center text-2xl font-semibold">Bienvenue !</h1>
      <p className="mt-2 text-center text-sm text-zinc-500">
        Déjà un compte ?{' '}
        <Link
          href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-blue-600 hover:underline"
        >
          Se connecter
        </Link>
      </p>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="username" className="mb-1 block text-sm font-medium">
              Nom d&apos;utilisateur
            </label>
            <input
              id="username"
              autoComplete="username"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              autoComplete="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-lg border border-zinc-300 px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium">
              Mot de passe
            </label>
            <input
              id="password"
              autoComplete="new-password"
              type="password"
              required
              minLength={8}
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
            {isLoading ? 'Inscription…' : 'S&apos;inscrire'}
          </button>
        </form>
      </div>
    </div>
  );
}
