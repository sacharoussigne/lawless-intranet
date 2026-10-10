import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Lawless Auth',
  description: 'Identity provider for Lawless Intranet',
};

/** Phones: the login page often opens inside the installed dispensary app (Safari sheet). */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // Same as the page background (bg-zinc-50).
  themeColor: '#fafafa',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="min-h-dvh bg-zinc-50 text-zinc-900 antialiased">
        {children}
      </body>
    </html>
  );
}
