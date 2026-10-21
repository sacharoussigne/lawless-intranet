import { redirect } from 'next/navigation';

/** Kept for old links and redirects: the root page now shows the businesses (or the welcome page). */
export default function NoBusinessAccessPage() {
  redirect('/');
}
