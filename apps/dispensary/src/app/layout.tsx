import type { Metadata, Viewport } from 'next';
import { Courier_Prime, Special_Elite } from 'next/font/google';
import { mantineHtmlProps } from '@mantine/core';
import { themeInitScript } from '@lawless-intranet/host-kit/theme';

import './globals.scss';
import '@mantine/core/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import 'mantine-datatable/styles.css';
import './mantine-overrides.scss';

import '@/lib/dayjs';
import { DISP_THEME_CONFIG, DISP_THEMES_CSS } from '@/lib/themes';
import { apothecaryTheme } from '@/lib/themes/apothecary';
import { nuitTheme } from '@/lib/themes/nuit';
import { ServiceWorkerRegister } from './_components/Pwa/ServiceWorkerRegister';
import { ThemeColorSync } from './_components/Pwa/ThemeColorSync';
import { MantineAppProvider } from './MantineAppProvider';

const fontUi = Courier_Prime({
  variable: '--font-ui',
  subsets: ['latin'],
  weight: ['400', '700'],
});

const fontDisplay = Special_Elite({
  variable: '--font-display',
  subsets: ['latin'],
  weight: '400',
});

export const metadata: Metadata = {
  title: {
    template: '%s | Dispensaire',
    default: 'Dispensaire',
  },
  // Home screen web app on iPhone (« Sur l'écran d'accueil »); the manifest is app/manifest.ts.
  appleWebApp: {
    capable: true,
    title: 'Dispensaire',
    statusBarStyle: 'default',
  },
  icons: {
    icon: [{ url: '/favicon.png', type: 'image/png' }],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Content under the notch / home indicator, padded with env(safe-area-inset-*).
  viewportFit: 'cover',
  // First guess from the device scheme; ThemeColorSync then follows the theme chosen in the app.
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: apothecaryTheme.tokens.bg },
    { media: '(prefers-color-scheme: dark)', color: nuitTheme.tokens.bg },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${fontDisplay.variable} ${fontUi.variable} ${fontUi.className}`}
      {...mantineHtmlProps}
    >
      <head>
        {/* Theme variables, then the saved theme applied before the first paint (replaces ColorSchemeScript). */}
        <style dangerouslySetInnerHTML={{ __html: DISP_THEMES_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(DISP_THEME_CONFIG) }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <MantineAppProvider>
          <ThemeColorSync />
          <ServiceWorkerRegister />
          <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
        </MantineAppProvider>
      </body>
    </html>
  );
}
