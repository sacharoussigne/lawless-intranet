import type { ReactNode } from 'react';

const SITE_URL = process.env.NEXT_PUBLIC_DISPENSARY_URL ?? 'http://localhost:3000';

/**
 * Login and signup frame: says plainly which site this is and what it is for.
 * An anonymous page with a Discord button and a password field looks like a
 * fake Discord login to Google Safe Browsing, which then blocks the domain.
 */
export function AuthPageShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))]">
      <header className="text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-zinc-500">
          Lawless · Intranet RP
        </p>
        <p className="mt-1 text-sm text-zinc-500">
          Espace de gestion du dispensaire et du refuge du serveur RedM Lawless.
        </p>
        <h1 className="mt-6 text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-sm text-zinc-500">{subtitle}</p>
      </header>

      <div className="mt-8 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>

      <footer className="mt-6 text-center text-xs text-zinc-500">
        <a href={SITE_URL} className="hover:underline">
          Retour à l&apos;intranet Lawless
        </a>
      </footer>
    </div>
  );
}
