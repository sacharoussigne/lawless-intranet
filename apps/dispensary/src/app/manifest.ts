import type { MetadataRoute } from 'next';
import { apothecaryTheme } from '@/lib/themes/apothecary';

/** Installable app (« Sur l'écran d'accueil » on iPhone). Served at /manifest.webmanifest, outside the middleware. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Dispensaire',
    short_name: 'Dispensaire',
    description: 'Intranet du dispensaire : activité, agenda, tâches et médiathèque.',
    lang: 'fr',
    // `/` redirects to the employee home of the first accessible dispensary.
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: apothecaryTheme.tokens.bg,
    theme_color: apothecaryTheme.tokens.bg,
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      // The emblem already sits inside the maskable safe zone (central 80 %).
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
