import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'Connexion · Lawless — Intranet RP',
};

export default async function HomePage() {
  const session = await getAuthSession();

  if (session) {
    redirect(process.env.DISPENSARY_URL ?? 'http://localhost:3000');
  }

  redirect('/login');
}
