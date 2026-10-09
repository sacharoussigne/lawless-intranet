import type { Metadata } from 'next';
import { Courier_Prime, Special_Elite } from 'next/font/google';
import { mantineHtmlProps } from '@mantine/core';
import { themeInitScript } from '@lawless-intranet/host-kit/theme';

import './globals.scss';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import '@mantine/notifications/styles.css';
import '@mantine/dropzone/styles.css';
import 'mantine-datatable/styles.css';
import './mantine-overrides.scss';

import { SHELTER_THEME_CONFIG, SHELTER_THEMES_CSS } from '@/lib/themes';
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
    template: '%s | Refuge',
    default: 'Refuge',
  },
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
        <style dangerouslySetInnerHTML={{ __html: SHELTER_THEMES_CSS }} />
        <script dangerouslySetInnerHTML={{ __html: themeInitScript(SHELTER_THEME_CONFIG) }} />
      </head>
      <body className="min-h-dvh flex flex-col">
        <MantineAppProvider>
          <div className="flex min-h-dvh flex-1 flex-col">{children}</div>
        </MantineAppProvider>
      </body>
    </html>
  );
}
